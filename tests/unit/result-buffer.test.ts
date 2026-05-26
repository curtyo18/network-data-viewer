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

  it("starts empty — size() is 0 and snapshot() returns []", () => {
    expect(buf.size()).toBe(0);
    expect(buf.snapshot()).toEqual([]);
  });

  it("push accumulates results", () => {
    buf.push(makeResult("a"));
    buf.push(makeResult("b"));
    expect(buf.size()).toBe(2);
    const snap = buf.snapshot();
    expect(snap[0].analyserId).toBe("a");
    expect(snap[1].analyserId).toBe("b");
  });

  it(`push past RESULT_BUFFER_SIZE (${RESULT_BUFFER_SIZE}) evicts the oldest entry`, () => {
    for (let i = 0; i < RESULT_BUFFER_SIZE + 2; i++) {
      buf.push(makeResult(`r${i}`));
    }
    expect(buf.size()).toBe(RESULT_BUFFER_SIZE);
    const snap = buf.snapshot();
    // r0 and r1 should have been evicted
    expect(snap[0].analyserId).toBe("r2");
    expect(snap[RESULT_BUFFER_SIZE - 1].analyserId).toBe(`r${RESULT_BUFFER_SIZE + 1}`);
  });

  it("snapshot returns a copy — mutating it does not affect the buffer", () => {
    buf.push(makeResult("x"));
    const snap = buf.snapshot();
    snap.push(makeResult("injected"));
    expect(buf.size()).toBe(1);
  });

  it("drain returns all results and clears the buffer", () => {
    buf.push(makeResult("a"));
    buf.push(makeResult("b"));
    const drained = buf.drain();
    expect(drained).toHaveLength(2);
    expect(drained[0].analyserId).toBe("a");
    expect(drained[1].analyserId).toBe("b");
    expect(buf.size()).toBe(0);
    expect(buf.snapshot()).toEqual([]);
  });

  it("drain on an empty buffer returns [] and does not throw", () => {
    expect(buf.drain()).toEqual([]);
    expect(buf.size()).toBe(0);
  });

  it("size reflects current count after mixed operations", () => {
    buf.push(makeResult("a"));
    buf.push(makeResult("b"));
    buf.push(makeResult("c"));
    expect(buf.size()).toBe(3);
    buf.drain();
    expect(buf.size()).toBe(0);
    buf.push(makeResult("d"));
    expect(buf.size()).toBe(1);
  });
});
