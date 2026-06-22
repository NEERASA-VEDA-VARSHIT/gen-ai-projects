# Architecture Document

## Overview

The Website Automation Agent follows a layered architecture inspired by Browser Use. The system is designed around the Observe → Analyze → Plan → Execute → Verify cycle, with clear separation of concerns across five layers.

```
┌─────────────────────────────────────────────────────┐
│                    Agent Layer                       │
│  BrowserAgent  Planner  Executor  Memory            │
├─────────────────────────────────────────────────────┤
│                    Tool Layer                        │
│  open_browser  navigate_to_url  click_on_screen      │
│  send_keys  scroll  double_click  take_screenshot    │
├─────────────────────────────────────────────────────┤
│                   Browser Layer                      │
│  BrowserManager  PageAnalyzer  ActionRunner          │
├─────────────────────────────────────────────────────┤
│                     LLM Layer                        │
│  OpenAI Agents SDK  Groq endpoint  ProviderFactory    │
├─────────────────────────────────────────────────────┤
│              Config / Logger / Types                 │
└─────────────────────────────────────────────────────┘
```

---

## 1. Agent Layer

The agent layer orchestrates the entire automation workflow.

### BrowserAgent (`src/agent/browser-agent.ts`)

The top-level orchestrator. It implements the five-phase workflow:

| Phase | Description |
|-------|-------------|
| **Observe** | Opens browser, navigates to URL, scrolls to content |
| **Analyze** | Runs PageAnalyzer to extract form fields from the DOM |
| **Plan** | Uses the Planner (with or without LLM) to generate fill steps |
| **Execute** | Runs each step sequentially via the Executor |
| **Verify** | Takes screenshots, logs results, checks for errors |

```typescript
class BrowserAgent {
  async run(task: string, url: string): Promise<AgentRunResult>;
}
```

### Planner (`src/agent/planner.ts`)

Generates a sequence of steps to fill form fields. Two modes:

- **Agent mode**: Sends page analysis to an OpenAI Agents SDK agent. It uses a Groq-hosted model through Groq's OpenAI-compatible endpoint and returns click/send_keys steps with document coordinates.

- **Heuristic mode**: Falls back to keyword matching against label text, placeholder, name, and id attributes. Uses weighted keyword lists for "name-like" and "description-like" fields.

```typescript
class Planner {
  async generatePlan(task: string, analysis: PageAnalysis): Promise<PlanResult>;
}
```

### Executor (`src/agent/executor.ts`)

Iterates through plan steps and executes each one. Features:

- Sequential step execution with progress logging
- Automatic one-retry on failure
- Error screenshot capture on failure
- Graceful abort on repeated failures

### Memory (`src/agent/memory.ts`)

In-memory state store tracking:

- Current URL
- Page analysis results
- Detected elements
- Completed actions
- Errors encountered
- Screenshots taken
- Overall status (idle → planning → executing → completed/failed)

---

## 2. Tool Layer

Each tool is a standalone, focused async function that performs one atomic operation. Tools are the building blocks of agent actions.

| Tool | Signature | Description |
|------|-----------|-------------|
| `open_browser` | `(BrowserManager, headless) => ActionResult` | Launches Chromium |
| `navigate_to_url` | `(Page, url) => ActionResult` | Navigates to URL |
| `click_on_screen` | `(Page, x, y) => ActionResult` | Clicks at pixel coordinates |
| `double_click` | `(Page, x, y) => ActionResult` | Double-clicks at coordinates |
| `send_keys` | `(Page, text) => ActionResult` | Types text into focused element |
| `scroll` | `(Page, amount) => ActionResult` | Scrolls page by pixels |
| `take_screenshot` | `(Page, name) => ActionResult` | Captures full-page screenshot |

All tools share the same return type:

```typescript
interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
```

---

## 3. Browser Layer

Manages the Playwright browser instance and provides higher-level abstractions.

### BrowserManager (`src/browser/browser-manager.ts`)

Singleton wrapper around Playwright's `chromium.launch()`. Manages the browser lifecycle:

- `init(headless)` — launches browser, creates page, sets viewport
- `close()` — closes browser gracefully
- `getPage()` — returns the active Page instance

### PageAnalyzer (`src/browser/page-analyzer.ts`)

The core intelligence for DOM-based field detection. Runs inside the browser context via `page.evaluate()` to extract:

1. **Labels**: All `<label>` elements with their text and `for` attributes
2. **Inputs**: All visible `<input>` elements (excluding hidden, submit, button, reset, file, image)
3. **Textareas**: All `<textarea>` elements
4. **Buttons**: All `<button>` elements and button-like inputs

For each element, it captures:
- Tag name, id, name, type, placeholder, aria-label
- Bounding box (x, y, width, height, centerX, centerY)
- **Label matching**: Resolves label→control association via:
  1. `for` / `id` matching
  2. Parent `<label>` wrapping
  3. `aria-labelledby` reference
  4. `aria-label` attribute

```typescript
class PageAnalyzer {
  async analyze(page: Page): Promise<PageAnalysis>;
  matchFieldsByHeuristic(analysis, targetLabels): MatchedField[];
}
```

### ActionRunner (`src/browser/action-runner.ts`)

Higher-level facade over Playwright Page actions. Used by the Executor to perform operations without direct Playwright dependency.

---

## 4. LLM Layer

The provider layer uses only the OpenAI Agents SDK for model orchestration. It configures the SDK for Groq's OpenAI-compatible Chat Completions endpoint.

### Provider Interface (`src/llm/types.ts`)

```typescript
interface LLMProvider {
  generateContent(prompt: string): Promise<string>;
  generateJSON<T>(prompt: string): Promise<T>;
}
```

### GroqAgentsProvider (`src/llm/openai.ts`)

- Orchestration: `@openai/agents`
- Inference endpoint: `https://api.groq.com/openai/v1`
- Default model: `llama-3.3-70b-versatile`
- Transport: OpenAI-compatible Chat Completions
- No `groq-sdk`, Gemini SDK, or OpenAI API key is required

### ProviderFactory (`src/llm/provider.ts`)

Creates the Groq-backed Agents SDK provider when `GROQ_API_KEY` is configured:

```typescript
function createLLMProvider(): LLMProvider | null;
```

Returns `null` if no API key is configured, allowing the agent to fall back to heuristic detection.

---

## 5. Execution Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  OBSERVE  │────▶│  ANALYZE  │────▶│   PLAN   │────▶│ EXECUTE  │────▶│  VERIFY  │
│          │     │          │     │          │     │          │     │          │
│ • Open    │     │ • Extract │     │ • LLM or │     │ • Click  │     │ • Screen │
│   browser │     │   DOM     │     │   heuri- │     │ • Type   │     │   shots  │
│ • Navigate│     │ • Match   │     │   stic   │     │ • Scroll │     │ • Log    │
│ • Scroll  │     │   labels  │     │ • Build  │     │ • Retry  │     │   errors │
└──────────┘     └──────────┘     │   steps  │     └──────────┘     └──────────┘
                                  └──────────┘
```

### Detailed Step Sequence

1. **CLI/API receives task** → creates `BrowserAgent`
2. **Observe Phase**:
   - `open_browser` — launches Chromium (headed by default)
   - `navigate_to_url` — goes to target URL with `networkidle` wait
   - `scroll` — scrolls down to reveal form content
   - `analyze_page` — extracts all form elements with coordinates
   - `take_screenshot('before-fill')` — captures baseline
3. **Analyze Phase**:
   - Stores page analysis in Memory
   - Logs detected elements count
4. **Plan Phase**:
   - Sends page analysis to Planner
   - LLM provider or heuristic generates fill steps with coordinates
5. **Execute Phase**:
   - Runs each step: click → type → click → type → screenshot
   - Each step retries once on failure
   - Error screenshots on repeated failures
6. **Verify Phase**:
   - Checks status (completed / failed)
   - Logs summary with action count, errors, screenshots
   - Returns `AgentRunResult`

### Error Handling Strategy

| Error Type | Handling |
|------------|----------|
| Timeout (navigation) | Caught by Playwright timeout, logged, retried once |
| Element not found | PageAnalyzer returns empty arrays, Planner adapts |
| Browser crash | Caught by try-catch in Executor, error screenshot saved |
| Navigation failure | `navigate` returns `{ success: false }`, step retried |
| LLM parse failure | Planner falls back to heuristic mode |
| Empty page analysis | Agent logs error, returns failed result |

---

## 6. Key Design Decisions

### Why Coordinate-Based Clicking Instead of Selectors?

The implementation uses coordinate-based clicking from DOM analysis to demonstrate the requested screen-interaction capability. This approach:

- Works on any page regardless of framework (React, Vue, Angular, static)
- Doesn't depend on specific CSS classes or HTML structure
- Can handle dynamic/shadow DOM content
- Demonstrates genuine reasoning — it analyzes first, then acts

### Why Two Planning Modes (LLM + Heuristic)?

- **LLM mode** provides semantic understanding — can match "Username" to "Name" task
- **Heuristic mode** ensures the agent works without API keys
- Both modes use the same PageAnalysis data, just different matching strategies

### Why Standalone CLI + Optional Web UI?

- CLI is the primary path — simple, fast, no server needed
- Web UI (Next.js) provides visualization — logs, screenshots, manual triggering
- The agent core has zero Next.js dependencies, making it reusable

---

## 7. Directory Structure

```
src/
├── agent/          # Orchestration (BrowserAgent, Planner, Executor, Memory)
├── browser/        # Playwright integration (BrowserManager, PageAnalyzer, ActionRunner)
├── tools/          # Atomic action functions (click, type, scroll, etc.)
├── llm/            # OpenAI Agents SDK configured for Groq inference
├── logger/         # Structured logging
├── config/         # Environment configuration with Zod validation
├── types/          # TypeScript interfaces and types
├── app/            # Next.js App Router (dashboard + API)
└── cli.ts          # CLI entry point
```

---

## 8. Dependencies

| Package | Purpose |
|---------|---------|
| `playwright` | Browser automation (Chromium) |
| `@openai/agents` | Agent orchestration and Groq-compatible model transport |
| `zod` | Runtime schema validation |
| `dotenv` | Environment variable loading |
| `next` / `react` | Web dashboard (optional) |
| `tsx` | TypeScript execution for CLI |
