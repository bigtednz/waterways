// Main exports for analytics-engine package
export { ANALYTICS_VERSION } from "./utils.js";
export type {
  RunResultData,
  CompetitionData,
  ScenarioAdjustmentData,
} from "./utils.js";
export {
  calculateMedian,
  calculateIQR,
  calculatePercentile,
  calculateCleanTime,
} from "./utils.js";

export {
  computeCompetitionTrends,
  computeRunDiagnostics,
  computeDrivers,
  computeRecoverableTime,
} from "./computations.js";

export { applyScenarioAdjustments } from "./scenarios.js";

export {
  validateRunAgainstSpec,
  getExpectedTimeFromSpec,
  getProcedureStepsFromSpec,
  compareToSpec,
  type SpecValidationResult,
} from "./specValidation.js";
