import { Router } from "express";
import { prisma } from "@waterways/db";
import { authenticate } from "../middleware/auth.js";
import type {
  CompetitionTrend,
  RunDiagnostic,
  DriverAnalysis,
  CoachingSummary,
} from "@waterways/shared";

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function calculateIQR(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  return q3 - q1;
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor((sorted.length - 1) * percentile);
  return sorted[index];
}

analyticsRouter.get("/competition-trends", async (req, res, next) => {
  try {
    const seasonId = req.query.seasonId as string | undefined;

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

    const trends: CompetitionTrend[] = competitions.map((comp) => {
      const cleanTimes = comp.runResults.map(
        (rr) => Math.max(0, rr.totalTimeSeconds - rr.penaltySeconds)
      );

      const medianCleanTime = calculateMedian(cleanTimes);
      const penaltyLoad = comp.runResults.reduce(
        (sum, rr) => sum + rr.penaltySeconds,
        0
      );
      const penaltyRate =
        comp.runResults.length > 0
          ? comp.runResults.filter((rr) => rr.penaltySeconds > 0).length /
            comp.runResults.length
          : 0;
      const consistencyIQR = calculateIQR(cleanTimes);

      return {
        competitionId: comp.id,
        competitionName: comp.name,
        competitionDate: comp.date.toISOString(),
        medianCleanTime,
        penaltyLoad,
        penaltyRate,
        consistencyIQR,
        runCount: comp.runResults.length,
      };
    });

    res.json(trends);
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/run-diagnostics", async (req, res, next) => {
  try {
    const runTypeCode = req.query.runTypeCode as string;
    const windowSize = parseInt(req.query.windowSize as string) || 3;

    if (!runTypeCode) {
      return res.status(400).json({ error: "runTypeCode is required" });
    }

    const runType = await prisma.runType.findUnique({
      where: { code: runTypeCode },
    });

    if (!runType) {
      return res.status(404).json({ error: "Run type not found" });
    }

    const runResults = await prisma.runResult.findMany({
      where: { runTypeId: runType.id },
      include: {
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

    const dataPoints = runResults.map((rr) => {
      const cleanTime = Math.max(0, rr.totalTimeSeconds - rr.penaltySeconds);
      return {
        competitionId: rr.competition.id,
        competitionName: rr.competition.name,
        competitionDate: rr.competition.date.toISOString(),
        cleanTime,
        penaltySeconds: rr.penaltySeconds,
        totalTimeSeconds: rr.totalTimeSeconds,
      };
    });

    const rollingMedian: Array<{ competitionDate: string; value: number }> = [];
    const rollingIQR: Array<{
      competitionDate: string;
      lower: number;
      upper: number;
    }> = [];

    for (let i = windowSize - 1; i < dataPoints.length; i++) {
      const window = dataPoints.slice(i - windowSize + 1, i + 1);
      const cleanTimes = window.map((dp) => dp.cleanTime);
      const median = calculateMedian(cleanTimes);
      const iqr = calculateIQR(cleanTimes);
      const q1 = calculatePercentile(cleanTimes, 0.25);
      const q3 = calculatePercentile(cleanTimes, 0.75);

      rollingMedian.push({
        competitionDate: window[window.length - 1].competitionDate,
        value: median,
      });

      rollingIQR.push({
        competitionDate: window[window.length - 1].competitionDate,
        lower: q1,
        upper: q3,
      });
    }

    const diagnostic: RunDiagnostic = {
      runTypeCode: runType.code,
      runTypeName: runType.name,
      dataPoints,
      rollingMedian,
      rollingIQR,
    };

    res.json(diagnostic);
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/drivers", async (req, res, next) => {
  try {
    const seasonId = req.query.seasonId as string | undefined;

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

    const runTypeMap = new Map<string, DriverAnalysis>();

    competitions.forEach((comp) => {
      comp.runResults.forEach((rr) => {
        const code = rr.runType.code;
        if (!runTypeMap.has(code)) {
          runTypeMap.set(code, {
            runTypeCode: code,
            runTypeName: rr.runType.name,
            penaltyCount: 0,
            totalPenaltySeconds: 0,
            taxonomyBreakdown: [],
            trendImpact: "stable",
          });
        }

        const analysis = runTypeMap.get(code)!;
        analysis.penaltyCount += rr.penalties.length;
        analysis.totalPenaltySeconds += rr.penaltySeconds;

        rr.penalties.forEach((penalty) => {
          const taxonomy = penalty.penaltyRule.taxonomyCode;
          let breakdown = analysis.taxonomyBreakdown.find(
            (b) => b.taxonomyCode === taxonomy
          );
          if (!breakdown) {
            breakdown = {
              taxonomyCode: taxonomy,
              count: 0,
              totalSeconds: 0,
            };
            analysis.taxonomyBreakdown.push(breakdown);
          }
          breakdown.count++;
          breakdown.totalSeconds += penalty.secondsApplied || 0;
        });
      });
    });

    const drivers = Array.from(runTypeMap.values()).sort(
      (a, b) => b.totalPenaltySeconds - a.totalPenaltySeconds
    );

    res.json(drivers);
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/coaching-summary", async (req, res, next) => {
  try {
    const seasonId = req.query.seasonId as string | undefined;
    const runTypeCode = req.query.runTypeCode as string | undefined;

    const competitions = await prisma.competition.findMany({
      where: seasonId ? { seasonId } : undefined,
      include: {
        runResults: {
          where: runTypeCode
            ? {
                runType: {
                  code: runTypeCode,
                },
              }
            : undefined,
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

    if (competitions.length < 3) {
      return res.json({
        narrative:
          "Insufficient data for coaching insights. Need at least 3 competitions.",
        confidence: "low",
        keyFindings: [],
        recommendedDrills: [],
      });
    }

    const allRuns = competitions.flatMap((c) => c.runResults);
    const cleanTimes = allRuns.map((rr) =>
      Math.max(0, rr.totalTimeSeconds - rr.penaltySeconds)
    );

    const recentCompetitions = competitions.slice(-3);
    const olderCompetitions = competitions.slice(0, -3);

    const recentCleanTimes = recentCompetitions.flatMap((c) =>
      c.runResults.map((rr) =>
        Math.max(0, rr.totalTimeSeconds - rr.penaltySeconds)
      )
    );
    const olderCleanTimes = olderCompetitions.flatMap((c) =>
      c.runResults.map((rr) =>
        Math.max(0, rr.totalTimeSeconds - rr.penaltySeconds)
      )
    );

    const recentMedian = calculateMedian(recentCleanTimes);
    const olderMedian = calculateMedian(olderCleanTimes);
    const trend = recentMedian < olderMedian ? "improving" : "deteriorating";

    const totalPenalties = allRuns.reduce(
      (sum, rr) => sum + rr.penaltySeconds,
      0
    );
    const penaltyRate =
      allRuns.length > 0
        ? allRuns.filter((rr) => rr.penaltySeconds > 0).length /
          allRuns.length
        : 0;

    const taxonomyMap = new Map<string, number>();
    allRuns.forEach((rr) => {
      rr.penalties.forEach((p) => {
        const code = p.penaltyRule.taxonomyCode;
        taxonomyMap.set(code, (taxonomyMap.get(code) || 0) + 1);
      });
    });

    const topTaxonomy = Array.from(taxonomyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code]) => code);

    const narrative = `Performance is ${trend}. Recent median clean time is ${recentMedian.toFixed(
      1
    )}s (${trend === "improving" ? "down" : "up"} from ${olderMedian.toFixed(
      1
    )}s). Penalty rate is ${(penaltyRate * 100).toFixed(0)}% with ${totalPenalties.toFixed(
      1
    )}s total penalty time.`;

    const keyFindings: string[] = [];
    if (penaltyRate > 0.3) {
      keyFindings.push("High penalty rate indicates procedural issues");
    }
    if (topTaxonomy.length > 0) {
      keyFindings.push(
        `Most common issues: ${topTaxonomy.join(", ")}`
      );
    }

    const drills = await prisma.drill.findMany({
      where: {
        linkedTaxonomyCodes: {
          hasSome: topTaxonomy,
        },
      },
    });

    const recommendedDrills = drills.map((d) => ({
      drillId: d.id,
      drillName: d.name,
      reason: `Addresses ${topTaxonomy
        .filter((t) => d.linkedTaxonomyCodes.includes(t))
        .join(", ")}`,
    }));

    const confidence =
      competitions.length >= 5 && allRuns.length >= 15
        ? "high"
        : competitions.length >= 3
        ? "medium"
        : "low";

    const summary: CoachingSummary = {
      narrative,
      confidence,
      keyFindings,
      recommendedDrills,
    };

    res.json(summary);
  } catch (error) {
    next(error);
  }
});
