import type { DslStep } from "@/shared/types";
import { applyStep } from "./apply-step";

export async function runDsl(chain: DslStep[], input: unknown): Promise<unknown> {
  let cur = input;
  for (const step of chain) {
    cur = await applyStep(step, cur);
  }
  return cur;
}
