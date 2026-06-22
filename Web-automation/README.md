# Website Automation Agent

An intelligent browser automation agent that autonomously navigates to web pages, detects form fields using DOM analysis and LLM reasoning, fills them with values, and captures screenshots — without hardcoded selectors.

Built with Next.js 15, TypeScript, Playwright, and the OpenAI Agents SDK. Groq supplies inference through its OpenAI-compatible API; no Groq client SDK is used.

## Architecture

```
Observe → Analyze → Plan → Execute → Verify
```

The agent follows a five-phase cycle inspired by Browser Use:

1. **Observe** — Open browser, navigate, capture page state
2. **Analyze** — Extract all form elements with coordinates via DOM analysis
3. **Plan** — Use LLM or heuristics to decide which fields to fill
4. **Execute** — Click, type, scroll with automatic retry on failure
5. **Verify** — Take screenshots, log results, surface errors

See [docs/architecture.md](docs/architecture.md) for the full architecture document.

## Features

- **Intelligent field detection** — No hardcoded selectors. Reads the DOM, extracts labels, inputs, textareas, and buttons, then matches them semantically.
- **Agent-powered planning** — Uses the OpenAI Agents SDK with a Groq-hosted model to identify form fields and generate fill steps.
- **Heuristic fallback** — Works without API keys via keyword-based field matching.
- **Coordinate-based interaction** — Clicks at element center coordinates rather than relying on framework-specific selectors.
- **Resilient execution** — Each step retries once on failure; error screenshots are captured automatically.
- **Full logging** — Structured console output + file-based logs with timestamps.
- **Dual interface** — CLI (primary) + Next.js web dashboard.

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd website-automation-agent

# Install dependencies
npm install

# The postinstall step will automatically download Chromium for Playwright.
# If it fails, run manually:
npx playwright install chromium
```

## Setup

Copy the environment file and configure:

```bash
cp .env.example .env
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | No* | — | Groq API key used by the OpenAI Agents SDK |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | Groq model identifier |
| `GROQ_BASE_URL` | No | `https://api.groq.com/openai/v1` | Groq OpenAI-compatible endpoint |
| `HEADLESS` | No | `false` | Run browser in headless mode |

\*Without a key, the deterministic heuristic planner is used.

### Getting API Keys

- **Groq**: https://console.groq.com/keys

## Usage

### CLI (Primary)

```bash
# Run with defaults (shadcn react-hook-form docs)
npm run agent

# Custom URL
npm run agent -- --url https://example.com/form

# Custom task
npm run agent -- --task "Fill the registration form with test data"

# Both
npm run agent -- --url https://example.com/form --task "Fill name and email"


# Help
npm run agent -- --help
```

### Web Dashboard

```bash
npm run dev
# Open http://localhost:3000
```

The dashboard provides:
- Task and URL input fields
- Real-time log streaming via Server-Sent Events
- Screenshot preview
- Result summary

## Project Structure

```
website-automation-agent/
│
├── src/
│   ├── agent/
│   │   ├── browser-agent.ts    # Top-level orchestrator
│   │   ├── planner.ts          # LLM + heuristic step generation
│   │   ├── executor.ts         # Sequential step execution with retry
│   │   └── memory.ts           # Agent state management
│   │
│   ├── browser/
│   │   ├── browser-manager.ts  # Playwright lifecycle
│   │   ├── page-analyzer.ts    # DOM extraction & label matching
│   │   └── action-runner.ts    # High-level action facade
│   │
│   ├── tools/
│   │   ├── open-browser.ts
│   │   ├── navigate-to-url.ts
│   │   ├── click-on-screen.ts
│   │   ├── send-keys.ts
│   │   ├── scroll.ts
│   │   ├── double-click.ts
│   │   └── take-screenshot.ts
│   │
│   ├── llm/
│   │   ├── types.ts            # Provider interface
│   │   ├── openai.ts           # OpenAI Agents SDK + Groq endpoint
│   │   └── provider.ts         # Provider factory/fallback selection
│   │
│   ├── logger/
│   │   └── logger.ts           # Structured logging
│   │
│   ├── config/
│   │   └── env.ts              # Zod-validated environment
│   │
│   ├── types/
│   │   └── agent.ts            # All TypeScript interfaces
│   │
│   ├── app/                    # Next.js dashboard (optional)
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── run-agent/route.ts
│   │       └── screenshots/route.ts
│   │
│   └── cli.ts                  # CLI entry point
│
├── screenshots/                # before-fill.png, after-fill.png, error.png
├── logs/                       # agent.log
├── docs/
│   └── architecture.md         # Full architecture document
├── .env.example
├── package.json
└── README.md
```

## Example Output

### CLI

```
  ╔══════════════════════════════════════════════╗
  ║      WEBSITE AUTOMATION AGENT v1.0           ║
  ╚══════════════════════════════════════════════╝

────────────────────────────────────────────────────────────
[2026-06-20 21:00:00] [INFO]  WEBSITE AUTOMATION AGENT
[2026-06-20 21:00:00] [INFO]  Task: Find and fill Name and Description fields
[2026-06-20 21:00:00] [INFO]  Target: https://ui.shadcn.com/docs/forms/react-hook-form
────────────────────────────────────────────────────────────
[2026-06-20 21:00:01] [INFO]  LLM provider initialized: GroqAgentsProvider
────────────────────────────────────────────────────────────
[2026-06-20 21:00:01] [INFO]  Phase 1: Observe — navigating and analyzing page
[2026-06-20 21:00:01] [INFO]  Starting execution of 5 steps...
[2026-06-20 21:00:01] [INFO]  [1/5] Launch browser
[2026-06-20 21:00:01] [INFO]  Launching browser...
[2026-06-20 21:00:03] [SUCCESS] Browser opened
[2026-06-20 21:00:03] [SUCCESS] Step 1 completed
[2026-06-20 21:00:03] [INFO]  [2/5] Navigate to https://ui.shadcn.com/docs/forms/react-hook-form
[2026-06-20 21:00:06] [SUCCESS] Reached https://ui.shadcn.com/docs/forms/react-hook-form
[2026-06-20 21:00:06] [SUCCESS] Step 2 completed
...
[2026-06-20 21:00:12] [SUCCESS] AGENT MISSION COMPLETED
────────────────────────────────────────────────────────────

  ╔══════════════════════════════════════════════╗
  ║  Status: ✅ SUCCESS                          ║
  ╚══════════════════════════════════════════════╝

  Actions completed: 12
  Errors:            0
  Screenshots:       2

  Screenshots saved:
    screenshots/before-fill.png
    screenshots/after-fill.png
```

### Log File (`logs/agent.log`)

```
[2026-06-20 21:00:01] [INFO] WEBSITE AUTOMATION AGENT
[2026-06-20 21:00:03] [SUCCESS] Browser opened
[2026-06-20 21:00:06] [INFO] Analyzing page DOM...
[2026-06-20 21:00:06] [INFO] Detected 3 labels, 2 inputs, 1 textareas, 2 buttons
[2026-06-20 21:00:06] [SUCCESS] Screenshot saved: before-fill.png
...
```

## Design Decisions

### Why coordinate-based clicking?

Coordinate-based interaction from DOM analysis works on any page regardless of framework, doesn't depend on CSS classes, and demonstrates genuine agent reasoning (analyze → decide → act).

### Why two planning modes?

**LLM mode** provides semantic understanding for complex pages. **Heuristic mode** ensures the agent works without API keys. Both use the same `PageAnalysis` data — just different matching strategies.

### Why standalone CLI + optional web UI?

The CLI is the primary evaluation path — simple, fast, no server needed. The web dashboard provides visualization (logs, screenshots, manual triggering) without dependencies on the agent core.

### Why Next.js 15?

Next.js provides a production-grade framework with TypeScript support, file-based routing for the dashboard, and API routes for the agent endpoint — all while keeping the agent core completely framework-independent.

## License

MIT
