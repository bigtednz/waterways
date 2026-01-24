import { describe, it, expect } from "vitest";
import {
  computeCompetitionTrends,
  computeRunDiagnostics,
  computeDrivers,
  computeRecoverableTime,
  applyScenarioAdjustments,
  calculateMedian,
  calculateIQR,
  calculateCleanTime,
} from "../index.js";
import type {
  CompetitionData,
  RunResultData,
  ScenarioAdjustmentData,
} from "../utils.js";

describe("Analytics Engine", () => {
  describe("Utility Functions", () => {
    it("should calculate median correctly", () => {
      expect(calculateMedian([1, 2, 3, 4, 5])).toBe(3);
      expect(calculateMedian([1, 2, 3, 4])).toBe(2.5);
      expect(calculateMedian([])).toBe(0);
    });

    it("should calculate IQR correctly", () => {
      expect(calculateIQR([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBeGreaterThan(0);
      expect(calculateIQR([])).toBe(0);
    });

    it("should calculate clean time correctly", () => {
      expect(calculateCleanTime(100, 10)).toBe(90);
      expect(calculateCleanTime(100, 150)).toBe(0); // Guarded against negative
    });
  });

  describe("computeCompetitionTrends", () => {
    it("should compute trends for competitions", () => {
      const competitions: CompetitionData[] = [
        {
          id: "comp1",
          name: "Competition 1",
          date: new Date("2024-01-01"),
          runResults: [
            {
              id: "rr1",
              competitionId: "comp1",
              runTypeId: "rt1",
              runTypeCode: "A1",
              runTypeName: "Run A1",
              totalTimeSeconds: 100,
              penaltySeconds: 10,
              penalties: [],
            },
            {
              id: "rr2",
              competitionId: "comp1",
              runTypeId: "rt2",
              runTypeCode: "A3",
              runTypeName: "Run A3",
              totalTimeSeconds: 90,
              penaltySeconds: 0,
              penalties: [],
            },
          ],
        },
      ];

      const trends = computeCompetitionTrends(competitions);
      expect(trends).toHaveLength(1);
      expect(trends[0].competitionId).toBe("comp1");
      expect(trends[0].medianCleanTime).toBe(90); // median of [90, 90]
      expect(trends[0].penaltyLoad).toBe(10);
      expect(trends[0].penaltyRate).toBe(0.5);
      expect(trends[0].runCount).toBe(2);
    });
  });

  describe("computeRunDiagnostics", () => {
    it("should compute diagnostics for run results", () => {
      const runResults: RunResultData[] = [
        {
          id: "rr1",
          competitionId: "comp1",
          runTypeId: "rt1",
          runTypeCode: "A1",
          runTypeName: "Run A1",
          totalTimeSeconds: 100,
          penaltySeconds: 10,
          penalties: [],
        },
        {
          id: "rr2",
          competitionId: "comp2",
          runTypeId: "rt1",
          runTypeCode: "A1",
          runTypeName: "Run A1",
          totalTimeSeconds: 95,
          penaltySeconds: 5,
          penalties: [],
        },
        {
          id: "rr3",
          competitionId: "comp3",
          runTypeId: "rt1",
          runTypeCode: "A1",
          runTypeName: "Run A1",
          totalTimeSeconds: 90,
          penaltySeconds: 0,
          penalties: [],
        },
      ];

      const diagnostic = computeRunDiagnostics(runResults, 3);
      expect(diagnostic.runTypeCode).toBe("A1");
      expect(diagnostic.dataPoints).toHaveLength(3);
      expect(diagnostic.rollingMedian.length).toBeGreaterThan(0);
    });
  });

  describe("computeDrivers", () => {
    it("should compute drivers analysis", () => {
      const competitions: CompetitionData[] = [
        {
          id: "comp1",
          name: "Competition 1",
          date: new Date("2024-01-01"),
          runResults: [
            {
              id: "rr1",
              competitionId: "comp1",
              runTypeId: "rt1",
              runTypeCode: "A1",
              runTypeName: "Run A1",
              totalTimeSeconds: 100,
              penaltySeconds: 10,
              penalties: [
                {
                  id: "p1",
                  penaltyRuleId: "pr1",
                  secondsApplied: 10,
                  penaltyRule: {
                    taxonomyCode: "ORDER_VIOLATION",
                    ruleId: "pr1",
                  },
                },
              ],
            },
          ],
        },
      ];

      const drivers = computeDrivers(competitions);
      expect(drivers).toHaveLength(1);
      expect(drivers[0].runTypeCode).toBe("A1");
      expect(drivers[0].penaltyCount).toBe(1);
      expect(drivers[0].totalPenaltySeconds).toBe(10);
    });
  });

  describe("computeRecoverableTime", () => {
    it("should compute recoverable time estimate", () => {
      const runResults: RunResultData[] = [
        {
          id: "rr1",
          competitionId: "comp1",
          runTypeId: "rt1",
          runTypeCode: "A1",
          runTypeName: "Run A1",
          totalTimeSeconds: 100,
          penaltySeconds: 10,
          penalties: [],
        },
        {
          id: "rr2",
          competitionId: "comp2",
          runTypeId: "rt1",
          runTypeCode: "A1",
          runTypeName: "Run A1",
          totalTimeSeconds: 110,
          penaltySeconds: 20,
          penalties: [],
        },
      ];

      const result = computeRecoverableTime(runResults);
      expect(result.totalPenaltySeconds).toBe(30);
      expect(result.recoverableTime).toBeGreaterThanOrEqual(30);
      expect(result.cleanTimes).toHaveLength(2);
    });
  });

  describe("applyScenarioAdjustments", () => {
    it("should remove penalties by taxonomy", () => {
      const competitions: CompetitionData[] = [
        {
          id: "comp1",
          name: "Competition 1",
          date: new Date("2024-01-01"),
          runResults: [
            {
              id: "rr1",
              competitionId: "comp1",
              runTypeId: "rt1",
              runTypeCode: "A1",
              runTypeName: "Run A1",
              totalTimeSeconds: 100,
              penaltySeconds: 10,
              penalties: [
                {
                  id: "p1",
                  penaltyRuleId: "pr1",
                  secondsApplied: 10,
                  penaltyRule: {
                    taxonomyCode: "ORDER_VIOLATION",
                    ruleId: "pr1",
                  },
                },
              ],
            },
          ],
        },
      ];

      const adjustments: ScenarioAdjustmentData[] = [
        {
          id: "adj1",
          scopeType: "COMPETITION",
          scopeId: "comp1",
          adjustmentType: "REMOVE_PENALTY_TAXONOMY",
          payloadJson: {
            taxonomyCode: "ORDER_VIOLATION",
          },
        },
      ];

      const adjusted = applyScenarioAdjustments(competitions, adjustments);
      expect(adjusted[0].runResults[0].penaltySeconds).toBe(0);
      expect(adjusted[0].runResults[0].penalties).toHaveLength(0);
    });

    it("should override penalty seconds", () => {
      const competitions: CompetitionData[] = [
        {
          id: "comp1",
          name: "Competition 1",
          date: new Date("2024-01-01"),
          runResults: [
            {
              id: "rr1",
              competitionId: "comp1",
              runTypeId: "rt1",
              runTypeCode: "A1",
              runTypeName: "Run A1",
              totalTimeSeconds: 100,
              penaltySeconds: 10,
              penalties: [
                {
                  id: "p1",
                  penaltyRuleId: "pr1",
                  secondsApplied: 10,
                  penaltyRule: {
                    taxonomyCode: "ORDER_VIOLATION",
                    ruleId: "pr1",
                  },
                },
              ],
            },
          ],
        },
      ];

      const adjustments: ScenarioAdjustmentData[] = [
        {
          id: "adj1",
          scopeType: "RUN_RESULT",
          scopeId: "rr1",
          adjustmentType: "OVERRIDE_PENALTY_SECONDS",
          payloadJson: {
            taxonomyCode: "ORDER_VIOLATION",
            newSeconds: 5,
          },
        },
      ];

      const adjusted = applyScenarioAdjustments(competitions, adjustments);
      expect(adjusted[0].runResults[0].penaltySeconds).toBe(5);
    });

    it("should apply clean time delta", () => {
      const competitions: CompetitionData[] = [
        {
          id: "comp1",
          name: "Competition 1",
          date: new Date("2024-01-01"),
          runResults: [
            {
              id: "rr1",
              competitionId: "comp1",
              runTypeId: "rt1",
              runTypeCode: "A1",
              runTypeName: "Run A1",
              totalTimeSeconds: 100,
              penaltySeconds: 10,
              penalties: [],
            },
          ],
        },
      ];

      const adjustments: ScenarioAdjustmentData[] = [
        {
          id: "adj1",
          scopeType: "RUN_RESULT",
          scopeId: "rr1",
          adjustmentType: "CLEAN_TIME_DELTA",
          payloadJson: {
            secondsDelta: 5,
          },
        },
      ];

      const adjusted = applyScenarioAdjustments(competitions, adjustments);
      expect(adjusted[0].runResults[0].totalTimeSeconds).toBe(95);
      // Clean time should be 95 - 10 = 85 (was 90)
    });
  });
});
