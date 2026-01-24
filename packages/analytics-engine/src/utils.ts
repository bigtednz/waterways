// Analytics Engine Version
export const ANALYTICS_VERSION = "2.0.0";

// Types for analytics engine inputs/outputs
export interface RunResultData {
  id: string;
  competitionId: string;
  runTypeId: string;
  runTypeCode: string;
  runTypeName: string;
  totalTimeSeconds: number;
  penaltySeconds: number;
  penalties: Array<{
    id: string;
    penaltyRuleId: string;
    secondsApplied: number | null;
    penaltyRule: {
      taxonomyCode: string;
      ruleId: string;
    };
  }>;
}

export interface CompetitionData {
  id: string;
  name: string;
  date: Date | string;
  runResults: RunResultData[];
}

export interface ScenarioAdjustmentData {
  id: string;
  scopeType: "SEASON" | "COMPETITION" | "RUN_TYPE" | "RUN_RESULT";
  scopeId: string | null;
  adjustmentType: "REMOVE_PENALTY_TAXONOMY" | "OVERRIDE_PENALTY_SECONDS" | "CLEAN_TIME_DELTA";
  payloadJson: Record<string, unknown>;
}

// Utility functions
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function calculateIQR(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  return q3 - q1;
}

export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor((sorted.length - 1) * percentile);
  return sorted[index];
}

export function calculateCleanTime(totalTime: number, penaltySeconds: number): number {
  return Math.max(0, totalTime - penaltySeconds);
}
