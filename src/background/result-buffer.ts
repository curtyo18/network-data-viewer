import type { MatchResult } from "@/shared/types";

export const RESULT_BUFFER_SIZE = 100;

export class ResultBuffer {
  private buf: MatchResult[] = [];

  push(r: MatchResult): void {
    this.buf.push(r);
    if (this.buf.length > RESULT_BUFFER_SIZE) this.buf.shift();
  }

  drain(): MatchResult[] {
    const out = this.buf;
    this.buf = [];
    return out;
  }

  snapshot(): MatchResult[] {
    return [...this.buf];
  }

  size(): number {
    return this.buf.length;
  }
}
