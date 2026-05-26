import { describe, it, expect } from "vitest";
import { runDslWithSteps } from "@/shared/dsl/preview";
import type { DslStep } from "@/shared/types";

describe("runDslWithSteps", () => {
  it("empty chain with a string input → one row (the input itself), no error", async () => {
    const rows = await runDslWithSteps([], "hello");
    expect(rows).toHaveLength(1);
    expect(rows[0].step).toBe("input");
    expect(rows[0].value).toBe("hello");
    expect(rows[0].error).toBeUndefined();
  });

  it("chain of two ops on a happy input → 3 rows (input + 2 outputs)", async () => {
    const chain: DslStep[] = [
      { op: "decode-uri" },
      { op: "json-parse" },
    ];
    const input = encodeURIComponent('{"x":1}');
    const rows = await runDslWithSteps(chain, input);
    expect(rows).toHaveLength(3);
    expect(rows[0].step).toBe("input");
    expect(rows[0].value).toBe(input);
    expect(rows[1].step).toEqual({ op: "decode-uri" });
    expect(rows[1].value).toBe('{"x":1}');
    expect(rows[1].error).toBeUndefined();
    expect(rows[2].step).toEqual({ op: "json-parse" });
    expect(rows[2].value).toEqual({ x: 1 });
    expect(rows[2].error).toBeUndefined();
  });

  it("chain that throws partway → rows up to and including failing step with error", async () => {
    const chain: DslStep[] = [
      { op: "decode-uri" },
      { op: "json-parse" },  // will fail: decoded string is not JSON
      { op: "pluck", keys: ["a"] },  // never reached
    ];
    const input = "hello%20world";
    const rows = await runDslWithSteps(chain, input);
    expect(rows).toHaveLength(3);
    expect(rows[0].step).toBe("input");
    expect(rows[1].step).toEqual({ op: "decode-uri" });
    expect(rows[1].error).toBeUndefined();
    expect(rows[2].step).toEqual({ op: "json-parse" });
    expect(rows[2].error).toBeDefined();
    expect(typeof rows[2].error).toBe("string");
  });

  it("chain on an input that fails the very first op → 2 rows (input + step with error)", async () => {
    const chain: DslStep[] = [{ op: "json-parse" }];
    const rows = await runDslWithSteps(chain, "not json");
    expect(rows).toHaveLength(2);
    expect(rows[0].step).toBe("input");
    expect(rows[0].value).toBe("not json");
    expect(rows[1].step).toEqual({ op: "json-parse" });
    expect(rows[1].error).toBeDefined();
    expect(typeof rows[1].error).toBe("string");
  });
});
