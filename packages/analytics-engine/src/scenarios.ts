import type {
  CompetitionData,
  RunResultData,
  ScenarioAdjustmentData,
} from "./utils.js";

/**
 * Apply scenario adjustments to baseline data
 * Returns a new array of competitions with adjustments applied
 */
export function applyScenarioAdjustments(
  competitions: CompetitionData[],
  adjustments: ScenarioAdjustmentData[]
): CompetitionData[] {
  // Deep clone to avoid mutating original data
  const adjusted = JSON.parse(JSON.stringify(competitions)) as CompetitionData[];

  // Group adjustments by scope for efficient lookup
  const adjustmentsByScope = new Map<string, ScenarioAdjustmentData[]>();
  adjustments.forEach((adj) => {
    const key = `${adj.scopeType}:${adj.scopeId || "ALL"}`;
    if (!adjustmentsByScope.has(key)) {
      adjustmentsByScope.set(key, []);
    }
    adjustmentsByScope.get(key)!.push(adj);
  });

  // Apply adjustments to each competition
  adjusted.forEach((comp) => {
    // Get adjustments for this competition
    const compAdjustments = [
      ...(adjustmentsByScope.get(`COMPETITION:${comp.id}`) || []),
      ...(adjustmentsByScope.get(`COMPETITION:ALL`) || []),
    ];

    comp.runResults.forEach((rr) => {
      // Get adjustments for this run result
      const runAdjustments = [
        ...compAdjustments,
        ...(adjustmentsByScope.get(`RUN_TYPE:${rr.runTypeId}`) || []),
        ...(adjustmentsByScope.get(`RUN_TYPE:${rr.runTypeCode}`) || []),
        ...(adjustmentsByScope.get(`RUN_RESULT:${rr.id}`) || []),
        ...(adjustmentsByScope.get(`RUN_TYPE:ALL`) || []),
        ...(adjustmentsByScope.get(`RUN_RESULT:ALL`) || []),
      ];

      // Apply adjustments in order
      runAdjustments.forEach((adj) => {
        switch (adj.adjustmentType) {
          case "REMOVE_PENALTY_TAXONOMY": {
            const taxonomyCode = adj.payloadJson.taxonomyCode as string;
            rr.penalties = rr.penalties.filter(
              (p) => p.penaltyRule.taxonomyCode !== taxonomyCode
            );
            // Recalculate penaltySeconds
            rr.penaltySeconds = rr.penalties.reduce(
              (sum, p) => sum + (p.secondsApplied || 0),
              0
            );
            break;
          }

          case "OVERRIDE_PENALTY_SECONDS": {
            const newSeconds = adj.payloadJson.newSeconds as number;
            const taxonomyCode = adj.payloadJson.taxonomyCode as
              | string
              | undefined;
            const penaltyRuleId = adj.payloadJson.penaltyRuleId as
              | string
              | undefined;

            if (taxonomyCode) {
              // Override all penalties with this taxonomy
              rr.penalties.forEach((p) => {
                if (p.penaltyRule.taxonomyCode === taxonomyCode) {
                  p.secondsApplied = newSeconds;
                }
              });
            } else if (penaltyRuleId) {
              // Override specific penalty rule
              rr.penalties.forEach((p) => {
                if (p.penaltyRuleId === penaltyRuleId) {
                  p.secondsApplied = newSeconds;
                }
              });
            }
            // Recalculate penaltySeconds
            rr.penaltySeconds = rr.penalties.reduce(
              (sum, p) => sum + (p.secondsApplied || 0),
              0
            );
            break;
          }

          case "CLEAN_TIME_DELTA": {
            const secondsDelta = adj.payloadJson.secondsDelta as number;
            const runTypeCodeFilter = adj.payloadJson.runTypeCode as
              | string
              | undefined;

            if (!runTypeCodeFilter || rr.runTypeCode === runTypeCodeFilter) {
              // Adjust totalTimeSeconds to achieve the clean time delta
              // If we want clean time to decrease by X, we decrease totalTime by X
              rr.totalTimeSeconds = Math.max(
                0,
                rr.totalTimeSeconds - secondsDelta
              );
            }
            break;
          }
        }
      });
    });
  });

  return adjusted;
}
