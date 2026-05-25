import { describe, it, expect } from "vitest";
import { runDsl } from "@/shared/dsl";
import type { DslStep } from "@/shared/types";

describe("runDsl", () => {
  it("returns input unchanged when chain is empty", async () => {
    expect(await runDsl([], "hello")).toBe("hello");
  });
  it("chains decode-uri then json-parse", async () => {
    const chain: DslStep[] = [{ op: "decode-uri" }, { op: "json-parse" }];
    const input = encodeURIComponent('{"x":1}');
    expect(await runDsl(chain, input)).toEqual({ x: 1 });
  });
  it("propagates errors from any step", async () => {
    const chain: DslStep[] = [{ op: "json-parse" }];
    await expect(runDsl(chain, "not json")).rejects.toThrow();
  });
});
