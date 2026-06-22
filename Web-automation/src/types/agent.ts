export type ActionType =
  | 'open_browser'
  | 'navigate_to_url'
  | 'take_screenshot'
  | 'click_on_screen'
  | 'double_click'
  | 'send_keys'
  | 'press_enter'
  | 'scroll'
  | 'analyze_page'
  | 'verify_fill';

export interface Step {
  action: ActionType;
  params?: Record<string, unknown>;
  description: string;
}

export interface PageElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface PageElement {
  tag: string;
  id: string | null;
  name: string | null;
  type: string | null;
  placeholder: string | null;
  ariaLabel: string | null;
  textContent: string | null;
  labelText: string | null;
  rect: PageElementRect;
}

export interface Label {
  text: string;
  forId: string | null;
  htmlFor: string | null;
}

export interface PageAnalysis {
  url: string;
  title: string;
  labels: Label[];
  inputs: PageElement[];
  textareas: PageElement[];
  buttons: PageElement[];
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentMemoryState {
  currentUrl: string;
  pageAnalysis: PageAnalysis | null;
  detectedElements: PageElement[];
  completedActions: string[];
  errors: string[];
  screenshots: string[];
  status: 'idle' | 'planning' | 'executing' | 'completed' | 'failed';
}

export interface PlanResult {
  steps: Step[];
  reasoning: string;
}

export interface AgentRunResult {
  success: boolean;
  summary: string;
  status: string;
  screenshots: string[];
  errors: string[];
  completedActions: number;
}
