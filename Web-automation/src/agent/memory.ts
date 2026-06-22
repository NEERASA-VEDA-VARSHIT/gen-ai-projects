import type { AgentMemoryState, PageAnalysis, PageElement, AgentRunResult } from '@/types/agent';

export class AgentMemory {
  private state: AgentMemoryState = {
    currentUrl: '',
    pageAnalysis: null,
    detectedElements: [],
    completedActions: [],
    errors: [],
    screenshots: [],
    status: 'idle',
  };

  getState(): AgentMemoryState {
    return { ...this.state };
  }

  setUrl(url: string): void {
    this.state.currentUrl = url;
  }

  setPageAnalysis(analysis: PageAnalysis): void {
    this.state.pageAnalysis = analysis;
    this.state.detectedElements = [...analysis.inputs, ...analysis.textareas];
  }

  addCompletedAction(action: string): void {
    this.state.completedActions.push(action);
  }

  addError(error: string): void {
    this.state.errors.push(error);
  }

  addScreenshot(name: string): void {
    this.state.screenshots.push(name);
  }

  setStatus(status: AgentMemoryState['status']): void {
    this.state.status = status;
  }

  getRunResult(): AgentRunResult {
    return {
      success: this.state.status === 'completed',
      summary: this.getSummary(),
      status: this.state.status,
      screenshots: [...this.state.screenshots],
      errors: [...this.state.errors],
      completedActions: this.state.completedActions.length,
    };
  }

  getSummary(): string {
    const s = this.state;
    const lines: string[] = [
      `Status: ${s.status}`,
      `URL: ${s.currentUrl || 'N/A'}`,
      `Elements detected: ${s.detectedElements.length}`,
      `Actions completed: ${s.completedActions.length}`,
      `Errors: ${s.errors.length}`,
      `Screenshots: ${s.screenshots.length}`,
    ];
    if (s.errors.length > 0) {
      lines.push('Error details:');
      s.errors.forEach((e) => lines.push(`  - ${e}`));
    }
    return lines.join('\n');
  }
}
