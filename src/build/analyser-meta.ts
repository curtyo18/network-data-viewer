import type { AnalyserSource, DslStep } from "@/shared/types";

export type AnalyserMeta = {
  id: string;
  name: string;
  enabled: boolean;
  urlPattern: string;
  source: AnalyserSource;
  dsl: DslStep[];
  seedVersion: number;
  createdAt: number;
};
