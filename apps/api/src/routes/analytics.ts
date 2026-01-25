import { Router } from "express";
import { prisma } from "@waterways/db";
import { Prisma } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import type {
  CompetitionTrend,
  RunDiagnostic,
  DriverAnalysis,
  CoachingSummary,
} from "@waterways/shared";
import {
  ANALYTICS_VERSION,
  computeCompetitionTrends,
  computeRunDiagnostics,
  computeDrivers,
  applyScenarioAdjustments,
  validateRunAgainstSpec,
  compareToSpec,
  getExpectedTimeFromSpec,
} from "@waterways/analytics-engine";
import {
  loadCompetitionsForAnalytics,
  loadRunResultsForDiagnostics,
  loadCompetitionsForRunType,
  loadScenarioAdjustments,
  createStableParamsJson,
} from "../lib/analyticsDataLoader.js";
import { calculateMedian } from "@waterways/analytics-engine";

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);

/**
 * Helper to optionally persist analytics results
 */
async function persistAnalyticsResult(
  computationType: string,
  params: Record<string, unknown>,
  output: unknown,
  artifactKey: string,
  scopeType?: string,
  scopeId?: string,
  scenarioId?: string,
  createdById?: string,
  durationMs?: number
): Promise<void> {
  try {
    const paramsJson = JSON.parse(createStableParamsJson(params)) as Prisma.InputJsonValue;
    const analyticsRun = await prisma.analyticsRun.create({
      data: {
        analyticsVersion: ANALYTICS_VERSION,
        computationType,
        paramsJson,
        scopeType: scopeType || null,
        scopeId: scopeId || null,
        scenarioId: scenarioId || null,
        status: "completed",
        durationMs,
        createdById: createdById || null,
      },
    });

    await prisma.analyticsArtifact.create({
      data: {
        analyticsRunId: analyticsRun.id,
        analyticsVersion: ANALYTICS_VERSION,
        artifactKey,
        outputJson: output as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    // Don't fail the request if persistence fails
    console.error("Failed to persist analytics result:", error);
  }
}

analyticsRouter.get("/competition-trends", async (req, res, next) => {
  try {
    const startTime = Date.now();
    const seasonId = req.query.seasonId as string | undefined;
    const scenarioId = req.query.scenarioId as string | undefined;
    const persist = req.query.persist === "true";

    // Load baseline data
    let competitions = await loadCompetitionsForAnalytics(seasonId);

    // Apply scenario adjustments if provided
    let adjustments: Awaited<ReturnType<typeof loadScenarioAdjustments>> = [];
    if (scenarioId) {
      adjustments = await loadScenarioAdjustments(scenarioId);
      competitions = applyScenarioAdjustments(competitions, adjustments);
    }

    // Compute trends using analytics engine
    const trends = computeCompetitionTrends(competitions);

    const durationMs = Date.now() - startTime;

    // Optionally persist results
    if (persist) {
      await persistAnalyticsResult(
        "competition-trends",
        { seasonId, scenarioId },
        trends,
        scenarioId
          ? `competition-trends:seasonId=${seasonId || "all"}:scenarioId=${scenarioId}`
          : `competition-trends:seasonId=${seasonId || "all"}`,
        seasonId ? "SEASON" : undefined,
        seasonId || undefined,
        scenarioId || undefined,
        (req as AuthRequest).userId || undefined,
        durationMs
      );
    }

    res.json(trends);
  } catch (error) {
    next(error);
  }
});

analyticsRouter.get("/run-diagnostics", async (req, res, next) => {
  try {
    console.log("[/analytics/run-diagnostics] Request received");
    const startTime = Date.now();
    const runTypeCode = req.query.runTypeCode as string;
    const windowSize = parseInt(req.query.windowSize as string) || 3;
    const scenarioId = req.query.scenarioId as string | undefined;
    const persist = req.query.persist === "true";

    console.log("[/analytics/run-diagnostics] Params:", { runTypeCode, windowSize, scenarioId });

    if (!runTypeCode) {
      console.log("[/analytics/run-diagnostics] Error: runTypeCode is required");
      return res.status(400).json({ error: "runTypeCode is required" });
    }

    console.log("[/analytics/run-diagnostics] Looking up run type:", runTypeCode);
    const runType = await prisma.runType.findUnique({
      where: { code: runTypeCode },
    });

    if (!runType) {
      console.log("[/analytics/run-diagnostics] Error: Run type not found:", runTypeCode);
      return res.status(404).json({ error: "Run type not found" });
    }

    console.log("[/analytics/run-diagnostics] Run type found:", runType.id);
    // Load baseline data
    console.log("[/analytics/run-diagnostics] Loading run results...");
    let runResults = await loadRunResultsForDiagnostics(runType.id);
    console.log("[/analytics/run-diagnostics] Loaded", runResults.length, "run results");

    // Apply scenario adjustments if provided
    if (scenarioId) {
      const adjustments = await loadScenarioAdjustments(scenarioId);
      // Load competitions structure for scenario application
      const competitions = await loadCompetitionsForRunType(runType.id);
      const adjustedCompetitions = applyScenarioAdjustments(
        competitions,
        adjustments
      );
      // Extract run results for the specific run type
      runResults = adjustedCompetitions.flatMap((comp) => comp.runResults);
    }

    // Compute diagnostics using analytics engine
    console.log("[/analytics/run-diagnostics] Computing diagnostics...");
    const diagnostic = computeRunDiagnostics(runResults, windowSize);
    console.log("[/analytics/run-diagnostics] Diagnostics computed");

    // Fill in competition details
    const competitions = await prisma.competition.findMany({
      where: {
        id: { in: runResults.map((rr) => rr.competitionId) },
      },
    });
    const competitionMap = new Map(
      competitions.map((c) => [c.id, c])
    );

    diagnostic.dataPoints = diagnostic.dataPoints.map((dp) => {
      const comp = competitionMap.get(dp.competitionId);
      return {
        ...dp,
        competitionName: comp?.name || "",
        competitionDate: comp?.date.toISOString() || "",
      };
    });

    diagnostic.rollingMedian = diagnostic.rollingMedian.map((rm) => {
      // Find matching data point to get date
      const dp = diagnostic.dataPoints.find(
        (d) => d.competitionDate === rm.competitionDate
      );
      return {
        ...rm,
        competitionDate: dp?.competitionDate || rm.competitionDate,
      };
    });

    diagnostic.rollingIQR = diagnostic.rollingIQR.map((riqr) => {
      const dp = diagnostic.dataPoints.find(
        (d) => d.competitionDate === riqr.competitionDate
      );
      return {
        ...riqr,
        competitionDate: dp?.competitionDate || riqr.competitionDate,
      };
    });

    const durationMs = Date.now() - startTime;
    console.log("[/analytics/run-diagnostics] Completed in", durationMs, "ms");

    // Optionally persist results
    if (persist) {
      await persistAnalyticsResult(
        "run-diagnostics",
        { runTypeCode, windowSize, scenarioId },
        diagnostic,
        scenarioId
          ? `run-diagnostics:${runTypeCode}:scenarioId=${scenarioId}`
          : `run-diagnostics:${runTypeCode}`,
        "RUN_TYPE",
        runType.id,
        scenarioId || undefined,
        (req as AuthRequest).userId || undefined,
        durationMs
      );
    }

    // If scenario provided, also compute baseline for comparison
    if (scenarioId) {
      const baselineRunResults = await loadRunResultsForDiagnostics(runType.id);
      const baseline = computeRunDiagnostics(baselineRunResults, windowSize);
      console.log("[/analytics/run-diagnostics] Sending response with baseline");
      res.json({
        baseline,
        scenario: diagnostic,
        delta: {
          medianImprovement: baseline.rollingMedian[baseline.rollingMedian.length - 1]?.value -
            diagnostic.rollingMedian[diagnostic.rollingMedian.length - 1]?.value || 0,
        },
      });
    } else {
      console.log("[/analytics/run-diagnostics] Sending response");
      res.json(diagnostic);
    }
  } catch (error) {
    console.error("[/analytics/run-diagnostics] Error:", error);
    if (error instanceof Error) {
      console.error("[/analytics/run-diagnostics] Error name:", error.name);
      console.error("[/analytics/run-diagnostics] Error message:", error.message);
      if (error.stack) {
        console.error("[/analytics/run-diagnostics] Error stack:", error.stack);
      }
    }
    next(error);
  }
});

analyticsRouter.get("/drivers", async (req, res, next) => {
  try {
    const startTime = Date.now();
    const seasonId = req.query.seasonId as string | undefined;
    const scenarioId = req.query.scenarioId as string | undefined;
    const persist = req.query.persist === "true";

    // Load baseline data
    let competitions = await loadCompetitionsForAnalytics(seasonId);

    // Apply scenario adjustments if provided
    let adjustments: Awaited<ReturnType<typeof loadScenarioAdjustments>> = [];
    if (scenarioId) {
      adjustments = await loadScenarioAdjustments(scenarioId);
      competitions = applyScenarioAdjustments(competitions, adjustments);
    }

    // Compute drivers using analytics engine
    const drivers = computeDrivers(competitions);

    const durationMs = Date.now() - startTime;

    // Optionally persist results
    if (persist) {
      await persistAnalyticsResult(
        "drivers",
        { seasonId, scenarioId },
        drivers,
        scenarioId
          ? `drivers:seasonId=${seasonId || "all"}:scenarioId=${scenarioId}`
          : `drivers:seasonId=${seasonId || "all"}`,
        seasonId ? "SEASON" : undefined,
        seasonId || undefined,
        scenarioId || undefined,
        (req as AuthRequest).userId || undefined,
        durationMs
      );
    }

    // If scenario provided, also compute baseline for comparison
    if (scenarioId) {
      const baselineCompetitions = await loadCompetitionsForAnalytics(seasonId);
      const baseline = computeDrivers(baselineCompetitions);
      res.json({
        baseline,
        scenario: drivers,
        delta: drivers.map((d) => {
          const baselineDriver = baseline.find(
            (b) => b.runTypeCode === d.runTypeCode
          );
          return {
            runTypeCode: d.runTypeCode,
            penaltySecondsDelta:
              (baselineDriver?.totalPenaltySeconds || 0) -
              d.totalPenaltySeconds,
          };
        }),
      });
    } else {
      res.json(drivers);
    }
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

// Validate a run result against its specification
analyticsRouter.get("/validate-run", async (req, res, next) => {
  try {
    const runResultId = req.query.runResultId as string;
    const runTypeCode = req.query.runTypeCode as string;

    if (!runResultId && !runTypeCode) {
      return res.status(400).json({ 
        error: "Either runResultId or runTypeCode is required" 
      });
    }

    // Load run result if ID provided
    let runResult;
    let runTypeCodeFromResult: string | undefined;

    if (runResultId) {
      const result = await prisma.runResult.findUnique({
        where: { id: runResultId },
        include: {
          runType: true,
        },
      });

      if (!result) {
        return res.status(404).json({ error: "Run result not found" });
      }

      const cleanTime = result.totalTimeSeconds - result.penaltySeconds;
      runResult = {
        cleanTime,
        penaltySeconds: result.penaltySeconds,
        totalTimeSeconds: result.totalTimeSeconds,
      };
      runTypeCodeFromResult = result.runType.code;
    }

    // Use provided runTypeCode or from result
    const code = runTypeCode || runTypeCodeFromResult;
    if (!code) {
      return res.status(400).json({ error: "Run type code is required" });
    }

    // Load specification
    const runType = await prisma.runType.findUnique({
      where: { code },
      include: {
        runSpecs: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    if (!runType) {
      return res.status(404).json({ error: "Run type not found" });
    }

    if (!runType.runSpecs || runType.runSpecs.length === 0) {
      return res.status(404).json({ 
        error: "No specification found for this run type",
        message: "Add a specification via the Admin page to enable validation"
      });
    }

    const latestSpec = runType.runSpecs[0];
    if (!latestSpec || !latestSpec.jsonSpec) {
      return res.status(404).json({ 
        error: "Invalid specification found",
        message: "The specification exists but has no JSON data"
      });
    }

    const spec = latestSpec.jsonSpec as any;

    // If run result provided, validate it
    if (runResult) {
      const validation = validateRunAgainstSpec(runResult, spec);
      const comparison = compareToSpec(
        { cleanTime: runResult.cleanTime, penaltySeconds: runResult.penaltySeconds },
        spec
      );
      const expectedTime = getExpectedTimeFromSpec(spec);

      return res.json({
        runType: {
          code: runType.code,
          name: runType.name,
        },
        specVersion: latestSpec.version,
        runResult: runResultId ? {
          id: runResultId,
          cleanTime: runResult.cleanTime,
          penaltySeconds: runResult.penaltySeconds,
        } : {
          cleanTime: runResult.cleanTime,
          penaltySeconds: runResult.penaltySeconds,
        },
        validation,
        comparison,
        expectedTime,
        specStructure: {
          hasTimeLimits: !!spec.timeLimits,
          hasPhases: !!spec.procedure?.phases,
          hasPenalties: !!spec.penalties,
        },
      });
    }

    // If no run result, just return spec info
    return res.json({
      runType: {
        code: runType.code,
        name: runType.name,
      },
      specVersion: runType.runSpecs[0].version,
      expectedTime: getExpectedTimeFromSpec(spec),
      specStructure: {
        hasTimeLimits: !!spec.timeLimits,
        hasPhases: !!spec.procedure?.phases,
        hasPenalties: !!spec.penalties,
        timeLimits: spec.timeLimits || null,
      },
      message: "No run result provided. Include runResultId to validate a specific run.",
    });
  } catch (error) {
    next(error);
  }
});
