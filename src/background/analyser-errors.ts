export type AnalyserError = { ts: number; stage: "dsl" | "sandbox"; message: string };
export const ERROR_BUFFER_SIZE = 5;

export class AnalyserErrorStore {
  private map = new Map<string, AnalyserError[]>();

  record(analyserId: string, err: { stage: AnalyserError["stage"]; message: string }): void {
    const buf = this.map.get(analyserId) ?? [];
    buf.push({ ts: Date.now(), stage: err.stage, message: err.message });
    if (buf.length > ERROR_BUFFER_SIZE) buf.shift();
    this.map.set(analyserId, buf);
  }

  clear(analyserId: string): void {
    this.map.delete(analyserId);
  }

  snapshot(): Record<string, AnalyserError[]> {
    return Object.fromEntries(this.map);
  }
}
