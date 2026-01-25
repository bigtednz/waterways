/**
 * Run Specification Validation Utilities
 * 
 * These functions use the JSON specification to validate run results,
 * check compliance, and provide insights based on the spec structure.
 */

export interface SpecValidationResult {
  isValid: boolean;
  violations: Array<{
    type: string;
    message: string;
    severity: "warning" | "error";
  }>;
  compliance: {
    timeWithinLimits?: boolean;
    requiredStepsCompleted?: boolean;
    equipmentCheck?: boolean;
  };
  insights: string[];
}

/**
 * Validate a run result against its specification
 * 
 * @param runResult - The run result to validate
 * @param spec - The JSON specification for this run type
 * @returns Validation result with violations and compliance checks
 */
export function validateRunAgainstSpec(
  runResult: {
    cleanTime: number;
    penaltySeconds: number;
    totalTimeSeconds?: number; // Optional, can be calculated
  },
  spec: any
): SpecValidationResult {
  const violations: SpecValidationResult["violations"] = [];
  const insights: string[] = [];
  const compliance: SpecValidationResult["compliance"] = {};

  // Check time limits if specified in spec
  if (spec.timeLimits) {
    const { minimum, maximum, target } = spec.timeLimits;
    
    if (minimum && runResult.cleanTime < minimum) {
      violations.push({
        type: "time_below_minimum",
        message: `Clean time (${runResult.cleanTime}s) is below minimum expected (${minimum}s)`,
        severity: "warning",
      });
    }
    
    if (maximum && runResult.cleanTime > maximum) {
      violations.push({
        type: "time_exceeds_maximum",
        message: `Clean time (${runResult.cleanTime}s) exceeds maximum expected (${maximum}s)`,
        severity: "warning",
      });
    }
    
    if (target) {
      const deviation = Math.abs(runResult.cleanTime - target);
      const deviationPercent = (deviation / target) * 100;
      
      if (deviationPercent > 20) {
        insights.push(
          `Performance deviates ${deviationPercent.toFixed(1)}% from target time (${target}s)`
        );
      } else if (deviationPercent < 5) {
        insights.push(`Excellent performance - within 5% of target time`);
      }
    }
    
    compliance.timeWithinLimits = 
      (!minimum || runResult.cleanTime >= minimum) &&
      (!maximum || runResult.cleanTime <= maximum);
  }

  // Check penalty load if spec defines penalty thresholds
  if (spec.penalties && runResult.penaltySeconds > 0) {
    const totalPenaltyThreshold = spec.penalties.maxAllowedSeconds || 30;
    
    if (runResult.penaltySeconds > totalPenaltyThreshold) {
      violations.push({
        type: "excessive_penalties",
        message: `Penalty load (${runResult.penaltySeconds}s) exceeds threshold (${totalPenaltyThreshold}s)`,
        severity: "error",
      });
    } else {
      insights.push(
        `Penalty load of ${runResult.penaltySeconds}s is within acceptable range`
      );
    }
  }

  // Check procedure phases if specified
  if (spec.procedure?.phases) {
    const phases = spec.procedure.phases;
    const totalExpectedTime = phases.reduce(
      (sum: number, phase: any) => sum + (phase.timeLimit || 0),
      0
    );
    
    if (totalExpectedTime > 0) {
      const timeRatio = runResult.cleanTime / totalExpectedTime;
      
      if (timeRatio > 1.2) {
        insights.push(
          `Run took ${((timeRatio - 1) * 100).toFixed(0)}% longer than expected procedure time`
        );
      } else if (timeRatio < 0.8) {
        insights.push(
          `Run completed ${((1 - timeRatio) * 100).toFixed(0)}% faster than expected`
        );
      }
    }
  }

  return {
    isValid: violations.filter((v) => v.severity === "error").length === 0,
    violations,
    compliance,
    insights,
  };
}

/**
 * Extract expected time from specification
 * 
 * @param spec - The JSON specification
 * @returns Expected time in seconds, or null if not specified
 */
export function getExpectedTimeFromSpec(spec: any): number | null {
  // Try different spec structures
  if (spec.timeLimits?.target) {
    return spec.timeLimits.target;
  }
  
  if (spec.procedure?.phases) {
    const total = spec.procedure.phases.reduce(
      (sum: number, phase: any) => sum + (phase.timeLimit || 0),
      0
    );
    return total > 0 ? total : null;
  }
  
  if (spec.totalEstimatedTime) {
    return spec.totalEstimatedTime;
  }
  
  return null;
}

/**
 * Get procedure steps from specification
 * 
 * @param spec - The JSON specification
 * @returns Array of procedure steps/phases
 */
export function getProcedureStepsFromSpec(spec: any): Array<{
  phase?: number;
  name?: string;
  steps?: string[];
  timeLimit?: number;
}> {
  if (spec.procedure?.phases) {
    return spec.procedure.phases;
  }
  
  if (spec.phases) {
    return spec.phases;
  }
  
  if (spec.tasks) {
    return spec.tasks.map((task: any) => ({
      name: task.name,
      timeLimit: task.estimatedTime,
    }));
  }
  
  return [];
}

/**
 * Compare actual performance to specification targets
 * 
 * @param runResult - The run result
 * @param spec - The JSON specification
 * @returns Comparison metrics
 */
export function compareToSpec(
  runResult: {
    cleanTime: number;
    penaltySeconds: number;
  },
  spec: any
): {
  expectedTime: number | null;
  actualTime: number;
  timeDifference: number | null;
  timeDifferencePercent: number | null;
  withinTargetRange: boolean | null;
} {
  const expectedTime = getExpectedTimeFromSpec(spec);
  const actualTime = runResult.cleanTime;
  
  return {
    expectedTime,
    actualTime,
    timeDifference: expectedTime ? actualTime - expectedTime : null,
    timeDifferencePercent: expectedTime
      ? ((actualTime - expectedTime) / expectedTime) * 100
      : null,
    withinTargetRange:
      expectedTime && spec.timeLimits
        ? actualTime >= (spec.timeLimits.minimum || 0) &&
          actualTime <= (spec.timeLimits.maximum || Infinity)
        : null,
  };
}
