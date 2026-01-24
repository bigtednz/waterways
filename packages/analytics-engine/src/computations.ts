import type {
  CompetitionTrend,
  RunDiagnostic,
  DriverAnalysis,
} from "@waterways/shared";
import type {
  CompetitionData,
  RunResultData,
  ScenarioAdjustmentData,
} from "./utils.js";
import {
  calculateMedian,
  calculateIQR,
  calculatePercentile,
  calculateCleanTime,
} from "./utils.js";

/**
 * Compute competition-level performance trends
 */
export function computeCompetitionTrends(
  competitions: CompetitionData[]
): CompetitionTrend[] {
  return competitions.map((comp) => {
    const cleanTimes = comp.runResults.map((rr) =>
      calculateCleanTime(rr.totalTimeSeconds, rr.penaltySeconds)
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
      competitionDate:
        typeof comp.date === "string" ? comp.date : comp.date.toISOString(),
      medianCleanTime,
      penaltyLoad,
      penaltyRate,
      consistencyIQR,
      runCount: comp.runResults.length,
    };
  });
}

/**
 * Compute run-level diagnostics for a specific run type
 */
export function computeRunDiagnostics(
  runResults: RunResultData[],
  windowSize: number = 3
): RunDiagnostic {
  if (runResults.length === 0) {
    throw new Error("No run results provided");
  }

  const runTypeCode = runResults[0].runTypeCode;
  const runTypeName = runResults[0].runTypeName;

  const dataPoints = runResults.map((rr) => {
    const cleanTime = calculateCleanTime(
      rr.totalTimeSeconds,
      rr.penaltySeconds
    );
    return {
      competitionId: rr.competitionId,
      competitionName: "", // Will be filled by caller if needed
      competitionDate: "", // Will be filled by caller if needed
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

  return {
    runTypeCode,
    runTypeName,
    dataPoints,
    rollingMedian,
    rollingIQR,
  };
}

/**
 * Compute performance drivers analysis
 */
export function computeDrivers(
  competitions: CompetitionData[]
): DriverAnalysis[] {
  const runTypeMap = new Map<string, DriverAnalysis>();

  competitions.forEach((comp) => {
    comp.runResults.forEach((rr) => {
      const code = rr.runTypeCode;
      if (!runTypeMap.has(code)) {
        runTypeMap.set(code, {
          runTypeCode: code,
          runTypeName: rr.runTypeName,
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

  return Array.from(runTypeMap.values()).sort(
    (a, b) => b.totalPenaltySeconds - a.totalPenaltySeconds
  );
}

/**
 * Compute recoverable time estimate
 * 
 * Recoverable time = penaltySeconds + variance estimate (using IQR)
 * 
 * The IQR represents consistency - a high IQR means high variance,
 * suggesting there's potential time to recover through consistency improvements.
 * We use IQR * 0.5 as a conservative estimate of recoverable variance.
 */
export function computeRecoverableTime(
  runResults: RunResultData[]
): {
  totalPenaltySeconds: number;
  varianceEstimate: number;
  recoverableTime: number;
  cleanTimes: number[];
  iqr: number;
} {
  const cleanTimes = runResults.map((rr) =>
    calculateCleanTime(rr.totalTimeSeconds, rr.penaltySeconds)
  );

  const totalPenaltySeconds = runResults.reduce(
    (sum, rr) => sum + rr.penaltySeconds,
    0
  );

  const iqr = calculateIQR(cleanTimes);
  // Conservative estimate: 50% of IQR represents recoverable variance
  const varianceEstimate = iqr * 0.5;

  const recoverableTime = totalPenaltySeconds + varianceEstimate;

  return {
    totalPenaltySeconds,
    varianceEstimate,
    recoverableTime,
    cleanTimes,
    iqr,
  };
}
