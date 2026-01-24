import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

export const seasonSchema = z.object({
  name: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const competitionSchema = z.object({
  seasonId: z.string(),
  name: z.string().min(1),
  date: z.string().datetime(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export const runResultSchema = z.object({
  competitionId: z.string(),
  runTypeId: z.string(),
  totalTimeSeconds: z.number().positive(),
  penaltySeconds: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

export const bulkRunResultSchema = z.object({
  competitionId: z.string(),
  runs: z.array(
    z.object({
      runTypeCode: z.string(),
      totalTimeSeconds: z.number().positive(),
      penaltySeconds: z.number().nonnegative().default(0),
      notes: z.string().optional(),
    })
  ),
});

export const runSpecSchema = z.object({
  runTypeId: z.string(),
  version: z.string().default("1.0.0"),
  jsonSpec: z.any(),
  markdownPath: z.string().optional(),
});

export const penaltyRuleSchema = z.object({
  ruleId: z.string(),
  runTypeCode: z.string().nullable(),
  ruleText: z.string().min(1),
  taxonomyCode: z.string(),
  severity: z.string(),
  outcomeType: z.string(),
  outcomeSeconds: z.number().nullable(),
  sourcePdfRef: z.string().optional(),
});

export const drillSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  linkedTaxonomyCodes: z.array(z.string()),
});

export const prescriptionSchema = z.object({
  runResultId: z.string().optional(),
  runTypeId: z.string().optional(),
  text: z.string().min(1),
});

export const scenarioSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional(),
});

export const scenarioAdjustmentSchema = z.object({
  scopeType: z.enum(["SEASON", "COMPETITION", "RUN_TYPE", "RUN_RESULT"]),
  scopeId: z.string().nullable(),
  adjustmentType: z.enum([
    "REMOVE_PENALTY_TAXONOMY",
    "OVERRIDE_PENALTY_SECONDS",
    "CLEAN_TIME_DELTA",
  ]),
  payloadJson: z.record(z.unknown()),
});
