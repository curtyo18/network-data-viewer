import { describe, it, expect, beforeEach } from "vitest";
import { ResultBuffer, RESULT_BUFFER_SIZE } from "@/background/result-buffer";
import type { MatchResult } from "@/shared/types";

function makeResult(id: string): MatchResult {
  return {
    analyserId: id,
    analyserName: `Analyser ${id}`,
    event: {
      id: `evt-${id}`,
      ts: 0,
      source: "fetch",
      method: "GET",
      url: "https://example.com",
      reqHeaders: {},
      reqBody: null,
      resStatus: 200,
      resHeaders: {},
      resBody: null,
    },
    dslOutput: {},
    latencyMs: 0,
  };
}

describe("ResultBuffer", () => {
  let buf: ResultBuffer;

  beforeEach(() => {
    buf = new ResultBuffer();
  });

  it("starts empty — snapshot() returns []", () => {
    expect(buf.snapshot()).toEqual([]);
  });

  it("push accumulates results", () => {
    buf.push(makeResult("a"));
    buf.push(makeResult("b"));
    const snap = buf.snapshot();
    expect(snap[0].analyserId).toBe("a");
    expect(snap[1].analyserId).toBe("b");
  });

  it(`push past RESULT_BUFFER_SIZE (${RESULT_BUFFER_SIZE}) evicts the oldest entry`, () => {
    for (let i = 0; i < RESULT_BUFFER_SIZE + 2; i++) {
      buf.push(makeResult(`r${i}`));
    }
    const snap = buf.snapshot();
    expect(snap).toHaveLength(RESULT_BUFFER_SIZE);
    // r0 and r1 should have been evicted
    expect(snap[0].analyserId).toBe("r2");
    expect(snap[RESULT_BUFFER_SIZE - 1].analyserId).toBe(`r${RESULT_BUFFER_SIZE + 1}`);
  });

  it("snapshot returns a copy — mutating it does not affect the buffer", () => {
    buf.push(makeResult("x"));
    const snap = buf.snapshot();
    snap.push(makeResult("injected"));
    expect(buf.snapshot()).toHaveLength(1);
  });
});
