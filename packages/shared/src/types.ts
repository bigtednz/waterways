import { z } from "zod";
import * as schemas from "./schemas.js";

export type LoginInput = z.infer<typeof schemas.loginSchema>;
export type RegisterInput = z.infer<typeof schemas.registerSchema>;
export type SeasonInput = z.infer<typeof schemas.seasonSchema>;
export type CompetitionInput = z.infer<typeof schemas.competitionSchema>;
export type RunResultInput = z.infer<typeof schemas.runResultSchema>;
export type BulkRunResultInput = z.infer<typeof schemas.bulkRunResultSchema>;
export type RunSpecInput = z.infer<typeof schemas.runSpecSchema>;
export type PenaltyRuleInput = z.infer<typeof schemas.penaltyRuleSchema>;
export type DrillInput = z.infer<typeof schemas.drillSchema>;
export type PrescriptionInput = z.infer<typeof schemas.prescriptionSchema>;

export interface CompetitionTrend {
  competitionId: string;
  competitionName: string;
  competitionDate: string;
  medianCleanTime: number;
  penaltyLoad: number;
  penaltyRate: number;
  consistencyIQR: number;
  runCount: number;
}

export interface RunDiagnostic {
  runTypeCode: string;
  runTypeName: string;
  dataPoints: Array<{
    competitionId: string;
    competitionName: string;
    competitionDate: string;
    cleanTime: number;
    penaltySeconds: number;
    totalTimeSeconds: number;
  }>;
  rollingMedian: Array<{
    competitionDate: string;
    value: number;
  }>;
  rollingIQR: Array<{
    competitionDate: string;
    lower: number;
    upper: number;
  }>;
}

export interface DriverAnalysis {
  runTypeCode: string;
  runTypeName: string;
  penaltyCount: number;
  totalPenaltySeconds: number;
  taxonomyBreakdown: Array<{
    taxonomyCode: string;
    count: number;
    totalSeconds: number;
  }>;
  trendImpact: "improving" | "deteriorating" | "stable";
}

export interface CoachingSummary {
  narrative: string;
  confidence: "high" | "medium" | "low";
  keyFindings: string[];
  recommendedDrills: Array<{
    drillId: string;
    drillName: string;
    reason: string;
  }>;
}
