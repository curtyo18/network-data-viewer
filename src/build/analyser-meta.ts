import type { DslStep } from "@/shared/types";

export type AnalyserMeta = {
  id: string;
  name: string;
  enabled: boolean;
  urlPattern: string;
  dsl: DslStep[];
  seedVersion: number;
  createdAt: number;
};
