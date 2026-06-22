export interface LLMProvider {
  generateContent(prompt: string): Promise<string>;
  generateJSON<T>(prompt: string): Promise<T>;
}
