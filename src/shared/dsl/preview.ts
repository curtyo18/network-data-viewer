import type { DslStep } from "@/shared/types";
import { applyStep } from "./apply-step";

export type PreviewRow = {
  step: DslStep | "input";
  value: unknown;
  error?: string;
};

export async function runDslWithSteps(
  steps: DslStep[],
  input: unknown,
): Promise<PreviewRow[]> {
  const rows: PreviewRow[] = [{ step: "input", value: input }];
  let cur = input;

  for (const step of steps) {
    try {
      cur = await applyStep(step, cur);
      rows.push({ step, value: cur });
    } catch (e) {
      rows.push({ step, value: cur, error: (e as Error).message });
      break;
    }
  }

  return rows;
}
