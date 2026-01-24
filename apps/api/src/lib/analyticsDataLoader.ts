import { prisma } from "@waterways/db";
import type {
  CompetitionData,
  RunResultData,
  ScenarioAdjustmentData,
} from "@waterways/analytics-engine";

/**
 * Load competitions with run results for analytics
 */
export async function loadCompetitionsForAnalytics(
  seasonId?: string
): Promise<CompetitionData[]> {
  const competitions = await prisma.competition.findMany({
    where: seasonId ? { seasonId } : undefined,
    include: {
      runResults: {
        include: {
          runType: true,
          penalties: {
            include: {
              penaltyRule: true,
            },
          },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  return competitions.map((comp) => ({
    id: comp.id,
    name: comp.name,
    date: comp.date,
    runResults: comp.runResults.map((rr) => ({
      id: rr.id,
      competitionId: rr.competitionId,
      runTypeId: rr.runTypeId,
      runTypeCode: rr.runType.code,
      runTypeName: rr.runType.name,
      totalTimeSeconds: rr.totalTimeSeconds,
      penaltySeconds: rr.penaltySeconds,
      penalties: rr.penalties.map((p) => ({
        id: p.id,
        penaltyRuleId: p.penaltyRuleId,
        secondsApplied: p.secondsApplied,
        penaltyRule: {
          taxonomyCode: p.penaltyRule.taxonomyCode,
          ruleId: p.penaltyRule.ruleId,
        },
      })),
    })),
  }));
}

/**
 * Load run results for a specific run type
 */
export async function loadRunResultsForDiagnostics(
  runTypeId: string
): Promise<RunResultData[]> {
  const runResults = await prisma.runResult.findMany({
    where: { runTypeId },
    include: {
      runType: true,
      competition: true,
      penalties: {
        include: {
          penaltyRule: true,
        },
      },
    },
    orderBy: {
      competition: {
        date: "asc",
      },
    },
  });

  return runResults.map((rr) => ({
    id: rr.id,
    competitionId: rr.competitionId,
    runTypeId: rr.runTypeId,
    runTypeCode: rr.runType.code,
    runTypeName: rr.runType.name,
    totalTimeSeconds: rr.totalTimeSeconds,
    penaltySeconds: rr.penaltySeconds,
    penalties: rr.penalties.map((p) => ({
      id: p.id,
      penaltyRuleId: p.penaltyRuleId,
      secondsApplied: p.secondsApplied,
      penaltyRule: {
        taxonomyCode: p.penaltyRule.taxonomyCode,
        ruleId: p.penaltyRule.ruleId,
      },
    })),
  }));
}

/**
 * Load scenario adjustments
 */
export async function loadScenarioAdjustments(
  scenarioId: string
): Promise<ScenarioAdjustmentData[]> {
  const adjustments = await prisma.scenarioAdjustment.findMany({
    where: { scenarioId },
    orderBy: { createdAt: "asc" },
  });

  return adjustments.map((adj) => ({
    id: adj.id,
    scopeType: adj.scopeType,
    scopeId: adj.scopeId,
    adjustmentType: adj.adjustmentType,
    payloadJson: adj.payloadJson as Record<string, unknown>,
  }));
}

/**
 * Load competitions containing runs for a specific run type
 * Used for scenario application in run diagnostics
 */
export async function loadCompetitionsForRunType(
  runTypeId: string
): Promise<CompetitionData[]> {
  const competitions = await prisma.competition.findMany({
    where: {
      runResults: {
        some: {
          runTypeId,
        },
      },
    },
    include: {
      runResults: {
        where: {
          runTypeId,
        },
        include: {
          runType: true,
          penalties: {
            include: {
              penaltyRule: true,
            },
          },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  return competitions.map((comp) => ({
    id: comp.id,
    name: comp.name,
    date: comp.date,
    runResults: comp.runResults.map((rr) => ({
      id: rr.id,
      competitionId: rr.competitionId,
      runTypeId: rr.runTypeId,
      runTypeCode: rr.runType.code,
      runTypeName: rr.runType.name,
      totalTimeSeconds: rr.totalTimeSeconds,
      penaltySeconds: rr.penaltySeconds,
      penalties: rr.penalties.map((p) => ({
        id: p.id,
        penaltyRuleId: p.penaltyRuleId,
        secondsApplied: p.secondsApplied,
        penaltyRule: {
          taxonomyCode: p.penaltyRule.taxonomyCode,
          ruleId: p.penaltyRule.ruleId,
        },
      })),
    })),
  }));
}

/**
 * Create stable params JSON for analytics run tracking
 */
export function createStableParamsJson(params: Record<string, unknown>): string {
  // Sort keys and stringify for stable comparison
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>);
  return JSON.stringify(sorted);
}
