import { describe, it, expect, beforeEach } from "vitest";
import { AnalyserErrorStore, ERROR_BUFFER_SIZE } from "@/background/analyser-errors";

describe("AnalyserErrorStore", () => {
  let store: AnalyserErrorStore;

  beforeEach(() => {
    store = new AnalyserErrorStore();
  });

  it("starts empty — snapshot returns {}", () => {
    expect(store.snapshot()).toEqual({});
  });

  it("record accumulates entries for an analyser", () => {
    store.record("a1", { stage: "dsl", message: "boom" });
    store.record("a1", { stage: "sandbox", message: "timeout" });
    const snap = store.snapshot();
    expect(snap["a1"]).toHaveLength(2);
    expect(snap["a1"][0].stage).toBe("dsl");
    expect(snap["a1"][1].stage).toBe("sandbox");
  });

  it("record attaches a ts timestamp", () => {
    const before = Date.now();
    store.record("a1", { stage: "dsl", message: "msg" });
    const after = Date.now();
    const snap = store.snapshot();
    expect(snap["a1"][0].ts).toBeGreaterThanOrEqual(before);
    expect(snap["a1"][0].ts).toBeLessThanOrEqual(after);
  });

  it(`evicts oldest entry when buffer exceeds ERROR_BUFFER_SIZE (${ERROR_BUFFER_SIZE})`, () => {
    for (let i = 0; i < ERROR_BUFFER_SIZE + 2; i++) {
      store.record("a1", { stage: "dsl", message: `msg${i}` });
    }
    const snap = store.snapshot();
    expect(snap["a1"]).toHaveLength(ERROR_BUFFER_SIZE);
    // oldest (msg0, msg1) evicted; msg2 is now first
    expect(snap["a1"][0].message).toBe("msg2");
    expect(snap["a1"][ERROR_BUFFER_SIZE - 1].message).toBe(`msg${ERROR_BUFFER_SIZE + 1}`);
  });

  it("clear removes all errors for the given analyser", () => {
    store.record("a1", { stage: "dsl", message: "boom" });
    store.clear("a1");
    expect(store.snapshot()["a1"]).toBeUndefined();
  });

  it("clear on unknown id does not throw", () => {
    expect(() => store.clear("unknown")).not.toThrow();
  });

  it("different analyser ids are isolated", () => {
    store.record("a1", { stage: "dsl", message: "err-a1" });
    store.record("a2", { stage: "sandbox", message: "err-a2" });
    const snap = store.snapshot();
    expect(snap["a1"]).toHaveLength(1);
    expect(snap["a2"]).toHaveLength(1);
    expect(snap["a1"][0].message).toBe("err-a1");
    expect(snap["a2"][0].message).toBe("err-a2");
  });

  it("clear one id does not affect another", () => {
    store.record("a1", { stage: "dsl", message: "err-a1" });
    store.record("a2", { stage: "dsl", message: "err-a2" });
    store.clear("a1");
    const snap = store.snapshot();
    expect(snap["a1"]).toBeUndefined();
    expect(snap["a2"]).toHaveLength(1);
  });

  it("snapshot returns a plain object (not a Map)", () => {
    store.record("a1", { stage: "dsl", message: "e" });
    const snap = store.snapshot();
    expect(snap.constructor).toBe(Object);
    expect(Object.keys(snap)).toContain("a1");
  });
});
