/**
 * Pacing Strategy Analyzer
 * 
 * Analyzes competition day pacing to:
 * - Calculate energy expenditure per run
 * - Track cumulative fatigue
 * - Identify optimal break points
 * - Warn about fatigue risk
 */

export interface RunQueueItem {
  id: string;
  sequenceNo: number;
  eventCode: string;
  status: "PLANNED" | "RUN" | "SKIPPED";
  attemptNo: number;
  totalTimeSeconds?: number | null;
  penaltySeconds?: number | null;
}

export interface EnergyProfile {
  baseEnergy: number; // Base energy cost (1-10 scale)
  timeMultiplier: number; // How time affects energy
  penaltyMultiplier: number; // How penalties affect energy
  typeMultiplier: number; // Event type difficulty
}

export interface PacingPoint {
  sequenceNo: number;
  eventCode: string;
  cumulativeEnergy: number;
  energyLevel: number; // Remaining energy (0-100)
  fatigueRisk: "low" | "medium" | "high" | "critical";
  recommendedBreak: boolean;
  breakReason?: string;
}

export interface BreakRecommendation {
  afterSequence: number;
  afterEvent: string;
  reason: string;
  duration: number; // Recommended break duration in minutes
  priority: "high" | "medium" | "low";
}

export interface PacingAnalysis {
  energyCurve: PacingPoint[];
  breakRecommendations: BreakRecommendation[];
  fatigueWarnings: Array<{
    sequenceNo: number;
    eventCode: string;
    severity: "high" | "critical";
    message: string;
  }>;
  totalEstimatedEnergy: number;
  peakFatiguePoint: number;
  recoveryOpportunities: number;
}

/**
 * Get energy profile for an event type
 */
function getEnergyProfile(eventCode: string, historicalData?: {
  avgTime?: number;
  bestTime?: number;
  avgPenalty?: number;
}): EnergyProfile {
  const code = eventCode.toUpperCase();
  const eventType = code[0]; // A, F, or P
  
  // Base energy by event type
  // A (Attack) = High intensity, moderate duration
  // F (Freestyle) = Very high intensity, shorter duration
  // P (Precision) = Moderate intensity, longer duration, mental focus
  const typeMultipliers: Record<string, number> = {
    'A': 7.0,  // Attack - high physical
    'F': 8.5,  // Freestyle - very high intensity
    'P': 6.0,  // Precision - moderate physical, high mental
  };
  
  const baseEnergy = typeMultipliers[eventType] || 6.0;
  
  // Adjust based on historical performance if available
  let timeMultiplier = 1.0;
  let penaltyMultiplier = 1.0;
  
  if (historicalData) {
    // Longer average times = more energy
    if (historicalData.avgTime) {
      // Normalize: 60s = 1.0x, 120s = 1.2x, 180s = 1.4x
      timeMultiplier = 1.0 + ((historicalData.avgTime - 60) / 300);
    }
    
    // Higher penalties = more stress/energy
    if (historicalData.avgPenalty) {
      penaltyMultiplier = 1.0 + (historicalData.avgPenalty / 50);
    }
  }
  
  return {
    baseEnergy,
    timeMultiplier: Math.max(0.8, Math.min(1.5, timeMultiplier)),
    penaltyMultiplier: Math.max(1.0, Math.min(1.3, penaltyMultiplier)),
    typeMultiplier: baseEnergy / 7.0, // Normalize to 1.0 average
  };
}

/**
 * Calculate energy expenditure for a single run
 */
function calculateRunEnergy(
  energyProfile: EnergyProfile,
  actualTime?: number | null,
  actualPenalty?: number | null
): number {
  const base = energyProfile.baseEnergy;
  
  // Use actual time if available, otherwise estimate
  const time = actualTime || 120; // Default estimate
  const penalty = actualPenalty || 0;
  
  // Energy = base * time_multiplier * penalty_multiplier
  const timeFactor = 1.0 + ((time - 60) / 300) * energyProfile.timeMultiplier;
  const penaltyFactor = 1.0 + (penalty / 50) * energyProfile.penaltyMultiplier;
  
  return base * timeFactor * penaltyFactor;
}

/**
 * Calculate recovery between runs
 */
function calculateRecovery(
  timeSinceLastRun: number, // minutes
  previousEnergyExpenditure: number
): number {
  // Recovery rate: ~10% per 5 minutes, up to 80% recovery
  const recoveryRate = 0.1; // 10% per 5 minutes
  const maxRecovery = 0.8; // Maximum 80% recovery
  
  const recoveryMinutes = Math.min(timeSinceLastRun, 40); // Cap at 40 minutes
  const recoveryPercent = Math.min(maxRecovery, (recoveryMinutes / 5) * recoveryRate);
  
  return previousEnergyExpenditure * recoveryPercent;
}

/**
 * Analyze pacing for a competition day
 */
export function analyzePacing(
  queueItems: RunQueueItem[],
  historicalData?: Record<string, {
    avgTime?: number;
    bestTime?: number;
    avgPenalty?: number;
  }>
): PacingAnalysis {
  const plannedRuns = queueItems.filter(item => item.status === "PLANNED" || item.status === "RUN");
  const sortedRuns = [...plannedRuns].sort((a, b) => a.sequenceNo - b.sequenceNo);
  
  let cumulativeEnergy = 0;
  let currentEnergyLevel = 100; // Start at 100%
  const energyCurve: PacingPoint[] = [];
  const breakRecommendations: BreakRecommendation[] = [];
  const fatigueWarnings: Array<{
    sequenceNo: number;
    eventCode: string;
    severity: "high" | "critical";
    message: string;
  }> = [];
  
  const estimatedTimeBetweenRuns = 15; // minutes (default estimate)
  
  for (let i = 0; i < sortedRuns.length; i++) {
    const item = sortedRuns[i];
    const historical = historicalData?.[item.eventCode];
    const energyProfile = getEnergyProfile(item.eventCode, historical);
    
    // Calculate energy for this run
    const runEnergy = calculateRunEnergy(
      energyProfile,
      item.totalTimeSeconds,
      item.penaltySeconds
    );
    
    // Apply recovery if not first run
    if (i > 0) {
      const recovery = calculateRecovery(estimatedTimeBetweenRuns, cumulativeEnergy);
      cumulativeEnergy = Math.max(0, cumulativeEnergy - recovery);
      currentEnergyLevel = Math.min(100, currentEnergyLevel + (recovery / 10));
    }
    
    // Add energy expenditure
    cumulativeEnergy += runEnergy;
    currentEnergyLevel = Math.max(0, 100 - (cumulativeEnergy / 10));
    
    // Determine fatigue risk
    let fatigueRisk: "low" | "medium" | "high" | "critical" = "low";
    if (currentEnergyLevel < 20) {
      fatigueRisk = "critical";
    } else if (currentEnergyLevel < 40) {
      fatigueRisk = "high";
    } else if (currentEnergyLevel < 60) {
      fatigueRisk = "medium";
    }
    
    // Check if break is recommended
    let recommendedBreak = false;
    let breakReason: string | undefined;
    
    if (currentEnergyLevel < 30 && i < sortedRuns.length - 1) {
      recommendedBreak = true;
      breakReason = "Critical energy level - rest recommended";
    } else if (currentEnergyLevel < 50 && cumulativeEnergy > 50 && i < sortedRuns.length - 1) {
      recommendedBreak = true;
      breakReason = "High cumulative fatigue - consider break";
    } else if (i > 0 && i % 3 === 0 && currentEnergyLevel < 70) {
      // Every 3 runs, suggest break if energy is below 70%
      recommendedBreak = true;
      breakReason = "Regular break point - maintain performance";
    }
    
    energyCurve.push({
      sequenceNo: item.sequenceNo,
      eventCode: item.eventCode,
      cumulativeEnergy,
      energyLevel: currentEnergyLevel,
      fatigueRisk,
      recommendedBreak,
      breakReason,
    });
    
    // Generate break recommendations
    if (recommendedBreak) {
      const priority: "high" | "medium" | "low" = 
        currentEnergyLevel < 30 ? "high" :
        currentEnergyLevel < 50 ? "medium" : "low";
      
      const duration = priority === "high" ? 20 : priority === "medium" ? 15 : 10;
      
      breakRecommendations.push({
        afterSequence: item.sequenceNo,
        afterEvent: item.eventCode,
        reason: breakReason || "Maintain performance",
        duration,
        priority,
      });
    }
    
    // Generate fatigue warnings
    if (fatigueRisk === "critical") {
      fatigueWarnings.push({
        sequenceNo: item.sequenceNo,
        eventCode: item.eventCode,
        severity: "critical",
        message: `Critical fatigue risk at ${item.eventCode} - performance likely to degrade significantly`,
      });
    } else if (fatigueRisk === "high" && i < sortedRuns.length - 2) {
      fatigueWarnings.push({
        sequenceNo: item.sequenceNo,
        eventCode: item.eventCode,
        severity: "high",
        message: `High fatigue at ${item.eventCode} - consider rest before next runs`,
      });
    }
  }
  
  // Find peak fatigue point
  const peakFatiguePoint = energyCurve.reduce((max, point) => 
    point.cumulativeEnergy > max.cumulativeEnergy ? point : max
  , energyCurve[0] || { cumulativeEnergy: 0, sequenceNo: 0 });
  
  return {
    energyCurve,
    breakRecommendations,
    fatigueWarnings,
    totalEstimatedEnergy: cumulativeEnergy,
    peakFatiguePoint: peakFatiguePoint.sequenceNo,
    recoveryOpportunities: breakRecommendations.length,
  };
}

/**
 * Format pacing analysis for display
 */
export function formatPacingAnalysis(analysis: PacingAnalysis): {
  summary: string;
  recommendations: string[];
  warnings: string[];
} {
  const recommendations: string[] = [];
  const warnings: string[] = [];
  
  // Summary
  const summary = `Pacing analysis for ${analysis.energyCurve.length} runs. ` +
    `Peak fatigue at run #${analysis.peakFatiguePoint}. ` +
    `${analysis.recoveryOpportunities} break opportunities identified.`;
  
  // Break recommendations
  analysis.breakRecommendations.forEach(rec => {
    recommendations.push(
      `After ${rec.afterEvent} (run #${rec.afterSequence}): ${rec.duration}-min break - ${rec.reason}`
    );
  });
  
  // Fatigue warnings
  analysis.fatigueWarnings.forEach(warning => {
    warnings.push(
      `${warning.eventCode} (run #${warning.sequenceNo}): ${warning.message}`
    );
  });
  
  return {
    summary,
    recommendations,
    warnings,
  };
}
