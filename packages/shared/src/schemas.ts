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
  startDate: z.string().optional(),
  endDate: z.string().optional(),
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

export const createRunSpecSchema = z.object({
  runTypeCode: z.string(),
  version: z.string().default("1.0.0"),
  jsonSpec: z.any(),
  markdownPath: z.string().optional(),
});

export const updateRunSpecSchema = z.object({
  version: z.string().optional(),
  jsonSpec: z.any().optional(),
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

export const competitionDaySchema = z.object({
  date: z.string().datetime(),
  challengeName: z.string().min(1),
  locationName: z.string().min(1),
  trackName: z.string().optional(),
  notes: z.string().optional(),
  teams: z.array(z.string().min(1)).optional(),
});

export const runQueueItemSchema = z.object({
  eventCode: z.string().min(1),
  status: z.enum(["PLANNED", "RUN", "SKIPPED"]).default("PLANNED"),
  attemptNo: z.number().int().positive().default(1),
  notes: z.string().optional(),
});

export const runQueueItemUpdateSchema = z.object({
  eventCode: z.string().min(1).optional(),
  status: z.enum(["PLANNED", "RUN", "SKIPPED"]).optional(),
  attemptNo: z.number().int().positive().optional(),
  notes: z.string().optional(),
  totalTimeSeconds: z.number().positive().optional().nullable(),
  penaltySeconds: z.number().nonnegative().optional().nullable(),
  splitTimes: z.record(z.number()).optional().nullable(),
});

export const competitorTimeSchema = z.object({
  teamName: z.string().min(1),
  ran: z.boolean().default(true),
  totalTimeSeconds: z.number().positive().optional().nullable(),
  penaltySeconds: z.number().nonnegative().optional().nullable().default(0),
  splitTimes: z.record(z.number()).optional().nullable(),
  notes: z.string().optional(),
});

export const competitorTimeUpdateSchema = z.object({
  teamName: z.string().min(1).optional(),
  ran: z.boolean().optional(),
  totalTimeSeconds: z.number().positive().optional().nullable(),
  penaltySeconds: z.number().nonnegative().optional().nullable(),
  splitTimes: z.record(z.number()).optional().nullable(),
  notes: z.string().optional(),
});

export const reorderQueueSchema = z.object({
  queueItemIds: z.array(z.string()),
});

export const goalTypeSchema = z.enum(["TIME", "PENALTY", "CONSISTENCY", "COMPLETION"]);
export const goalStatusSchema = z.enum(["ON_TRACK", "AT_RISK", "ACHIEVED", "MISSED", "NOT_STARTED"]);
export const goalAutoUpdateSourceSchema = z.enum(["MEDIAN_CLEAN_TIME", "PENALTY_LOAD", "CONSISTENCY_IQR", "COMPLETION_RATE"]).nullable();

export const goalHistoryEntrySchema = z.object({
  date: z.string().datetime(),
  current: z.number(),
  progress: z.number(),
  status: goalStatusSchema,
  note: z.string().optional(),
});

export const createGoalSchema = z.object({
  type: goalTypeSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  target: z.number().positive(),
  current: z.number().nonnegative().default(0),
  unit: z.string().min(1),
  deadline: z.string().datetime().optional().nullable(),
  seasonId: z.string().optional().nullable(),
  autoUpdate: z.boolean().default(false),
  autoUpdateSource: goalAutoUpdateSourceSchema,
});

export const updateGoalSchema = z.object({
  type: goalTypeSchema.optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  target: z.number().positive().optional(),
  current: z.number().nonnegative().optional(),
  unit: z.string().min(1).optional(),
  deadline: z.string().datetime().optional().nullable(),
  seasonId: z.string().optional().nullable(),
  autoUpdate: z.boolean().optional(),
  autoUpdateSource: goalAutoUpdateSourceSchema,
});
