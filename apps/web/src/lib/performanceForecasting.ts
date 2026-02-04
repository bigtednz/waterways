/**
 * Enhanced Performance Forecasting System
 * 
 * Provides comprehensive forecasting for:
 * - Time performance (median clean time)
 * - Penalty trends
 * - Consistency (IQR)
 * - Overall performance
 * - Improvement opportunities
 * - Risk assessment
 */

import type { CompetitionTrend } from "@waterways/shared";

export interface ForecastResult {
  metric: string;
  current: number;
  forecast: number;
  confidence: "high" | "medium" | "low";
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  trend: "improving" | "stable" | "declining";
  trendStrength: number; // 0-1, how strong the trend is
  improvementOpportunity?: {
    potential: number; // Potential improvement
    probability: number; // 0-1, likelihood of achieving
    factors: string[]; // What could drive improvement
  };
  riskFactors?: {
    level: "low" | "medium" | "high";
    factors: string[];
  };
}

export interface PerformanceForecast {
  timeForecast: ForecastResult;
  penaltyForecast: ForecastResult;
  consistencyForecast: ForecastResult;
  overallForecast: ForecastResult;
  nextCompetitionPrediction: {
    medianCleanTime: number;
    penaltyLoad: number;
    consistencyIQR: number;
    confidence: "high" | "medium" | "low";
    timeRange: {
      optimistic: number;
      realistic: number;
      pessimistic: number;
    };
  };
  improvementOpportunities: Array<{
    metric: string;
    current: number;
    target: number;
    potentialGain: number;
    probability: number;
    actionItems: string[];
  }>;
  riskAssessment: {
    overallRisk: "low" | "medium" | "high";
    risks: Array<{
      type: string;
      severity: "low" | "medium" | "high";
      description: string;
      mitigation: string[];
    }>;
  };
}

/**
 * Calculate linear regression for trend analysis
 */
function linearRegression(data: number[]): { slope: number; intercept: number; rSquared: number } {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0] || 0, rSquared: 0 };

  const x = Array.from({ length: n }, (_, i) => i);
  const y = data;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  const ssRes = y.reduce((sum, yi, i) => {
    const predicted = slope * x[i] + intercept;
    return sum + Math.pow(yi - predicted, 2);
  }, 0);
  const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared };
}

/**
 * Forecast a single metric
 */
function forecastMetric(
  metricName: string,
  values: number[],
  isLowerBetter: boolean = true
): ForecastResult {
  if (values.length < 2) {
    return {
      metric: metricName,
      current: values[0] || 0,
      forecast: values[0] || 0,
      confidence: "low",
      confidenceInterval: { lower: values[0] || 0, upper: values[0] || 0 },
      trend: "stable",
      trendStrength: 0,
    };
  }

  const current = values[values.length - 1];
  const { slope, intercept, rSquared } = linearRegression(values);
  const nextIndex = values.length;
  const forecast = slope * nextIndex + intercept;

  // Calculate confidence interval using standard error
  const residuals = values.map((y, i) => y - (slope * i + intercept));
  const mse = residuals.reduce((sum, r) => sum + r * r, 0) / (values.length - 2);
  const stdError = Math.sqrt(mse);
  const confidenceMargin = stdError * 1.96; // 95% confidence interval

  // Determine trend
  let trend: "improving" | "stable" | "declining";
  if (Math.abs(slope) < stdError * 0.5) {
    trend = "stable";
  } else if (isLowerBetter) {
    trend = slope < 0 ? "improving" : "declining";
  } else {
    trend = slope > 0 ? "improving" : "declining";
  }

  // Determine confidence level
  let confidence: "high" | "medium" | "low";
  if (values.length >= 5 && rSquared > 0.7) {
    confidence = "high";
  } else if (values.length >= 3 && rSquared > 0.4) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  // Calculate improvement opportunity
  const bestValue = isLowerBetter ? Math.min(...values) : Math.max(...values);
  const potential = isLowerBetter
    ? current - bestValue
    : bestValue - current;
  const improvementOpportunity = potential > 0 && Math.abs(potential) > stdError
    ? {
        potential: Math.abs(potential),
        probability: Math.min(0.9, 0.5 + (rSquared * 0.4)), // Higher R² = higher probability
        factors: getImprovementFactors(metricName, values, isLowerBetter),
      }
    : undefined;

  // Risk factors
  const riskFactors = identifyRiskFactors(metricName, values, forecast, isLowerBetter);

  return {
    metric: metricName,
    current,
    forecast: Math.max(0, forecast), // Ensure non-negative
    confidence,
    confidenceInterval: {
      lower: Math.max(0, forecast - confidenceMargin),
      upper: forecast + confidenceMargin,
    },
    trend,
    trendStrength: Math.abs(rSquared),
    improvementOpportunity,
    riskFactors,
  };
}

/**
 * Get improvement factors for a metric
 */
function getImprovementFactors(
  metricName: string,
  values: number[],
  isLowerBetter: boolean
): string[] {
  const factors: string[] = [];
  const recent = values.slice(-3);
  const variance = recent.reduce((sum, v, i, arr) => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return sum + Math.pow(v - mean, 2);
  }, 0) / recent.length;

  if (metricName.includes("Time") || metricName.includes("time")) {
    if (variance > 100) factors.push("Reduce time variance");
    if (isLowerBetter && values[values.length - 1] > values[0] * 1.1) {
      factors.push("Focus on technique consistency");
    }
    factors.push("Optimize run phases");
    factors.push("Reduce penalty time");
  } else if (metricName.includes("Penalty") || metricName.includes("penalty")) {
    if (values[values.length - 1] > 0) {
      factors.push("Review penalty patterns");
      factors.push("Focus on rule compliance");
    }
    factors.push("Practice penalty-prone events");
  } else if (metricName.includes("Consistency") || metricName.includes("IQR")) {
    factors.push("Standardize technique");
    factors.push("Reduce performance variance");
    factors.push("Focus on repeatability");
  }

  return factors;
}

/**
 * Identify risk factors
 */
function identifyRiskFactors(
  metricName: string,
  values: number[],
  forecast: number,
  isLowerBetter: boolean
): { level: "low" | "medium" | "high"; factors: string[] } | undefined {
  const factors: string[] = [];
  let level: "low" | "medium" | "high" = "low";

  const current = values[values.length - 1];
  const recent = values.slice(-3);
  const trend = recent[recent.length - 1] - recent[0];

  // Check for declining performance
  if (isLowerBetter && trend > 0 && trend > current * 0.1) {
    factors.push("Performance declining");
    level = "medium";
  } else if (!isLowerBetter && trend < 0 && Math.abs(trend) > current * 0.1) {
    factors.push("Performance declining");
    level = "medium";
  }

  // Check for high variance
  const variance = recent.reduce((sum, v, i, arr) => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return sum + Math.pow(v - mean, 2);
  }, 0) / recent.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev > current * 0.2) {
    factors.push("High performance variance");
    level = level === "low" ? "medium" : "high";
  }

  // Check forecast vs current
  if (isLowerBetter && forecast > current * 1.15) {
    factors.push("Forecast shows potential decline");
    level = "high";
  } else if (!isLowerBetter && forecast < current * 0.85) {
    factors.push("Forecast shows potential decline");
    level = "high";
  }

  if (factors.length === 0) return undefined;

  return { level, factors };
}

/**
 * Generate comprehensive performance forecast
 */
export function generatePerformanceForecast(
  trends: CompetitionTrend[]
): PerformanceForecast | null {
  if (trends.length < 2) return null;

  // Extract metric values
  const medianCleanTimes = trends.map(t => t.medianCleanTime);
  const penaltyLoads = trends.map(t => t.penaltyLoad);
  const consistencyIQRs = trends.map(t => t.consistencyIQR);

  // Forecast each metric
  const timeForecast = forecastMetric("Median Clean Time", medianCleanTimes, true);
  const penaltyForecast = forecastMetric("Penalty Load", penaltyLoads, true);
  const consistencyForecast = forecastMetric("Consistency IQR", consistencyIQRs, true);

  // Overall forecast (weighted combination)
  const overallScore = trends.map(t => {
    // Normalize metrics (lower is better for all)
    const normalizedTime = 1 - (t.medianCleanTime / 200); // Assuming 200s is a reasonable max
    const normalizedPenalty = 1 - Math.min(1, t.penaltyLoad / 50); // Assuming 50s is max penalty
    const normalizedConsistency = 1 - Math.min(1, t.consistencyIQR / 20); // Assuming 20s is max IQR
    return (normalizedTime * 0.5 + normalizedPenalty * 0.3 + normalizedConsistency * 0.2) * 100;
  });
  const overallForecast = forecastMetric("Overall Performance", overallScore, false);

  // Next competition prediction
  const nextCompetitionPrediction = {
    medianCleanTime: timeForecast.forecast,
    penaltyLoad: penaltyForecast.forecast,
    consistencyIQR: consistencyForecast.forecast,
    confidence: determineOverallConfidence([timeForecast, penaltyForecast, consistencyForecast]),
    timeRange: {
      optimistic: timeForecast.confidenceInterval.lower,
      realistic: timeForecast.forecast,
      pessimistic: timeForecast.confidenceInterval.upper,
    },
  };

  // Improvement opportunities
  const improvementOpportunities = [
    timeForecast.improvementOpportunity && {
      metric: "Median Clean Time",
      current: timeForecast.current,
      target: timeForecast.confidenceInterval.lower,
      potentialGain: timeForecast.improvementOpportunity.potential,
      probability: timeForecast.improvementOpportunity.probability,
      actionItems: timeForecast.improvementOpportunity.factors,
    },
    penaltyForecast.improvementOpportunity && {
      metric: "Penalty Load",
      current: penaltyForecast.current,
      target: penaltyForecast.confidenceInterval.lower,
      potentialGain: penaltyForecast.improvementOpportunity.potential,
      probability: penaltyForecast.improvementOpportunity.probability,
      actionItems: penaltyForecast.improvementOpportunity.factors,
    },
    consistencyForecast.improvementOpportunity && {
      metric: "Consistency IQR",
      current: consistencyForecast.current,
      target: consistencyForecast.confidenceInterval.lower,
      potentialGain: consistencyForecast.improvementOpportunity.potential,
      probability: consistencyForecast.improvementOpportunity.probability,
      actionItems: consistencyForecast.improvementOpportunity.factors,
    },
  ].filter(Boolean) as Array<{
    metric: string;
    current: number;
    target: number;
    potentialGain: number;
    probability: number;
    actionItems: string[];
  }>;

  // Risk assessment
  const risks = [
    timeForecast.riskFactors && {
      type: "Time Performance",
      severity: timeForecast.riskFactors.level,
      description: `Time performance shows ${timeForecast.trend} trend`,
      mitigation: getMitigationStrategies("time", timeForecast.riskFactors.factors),
    },
    penaltyForecast.riskFactors && {
      type: "Penalty Load",
      severity: penaltyForecast.riskFactors.level,
      description: `Penalty load shows ${penaltyForecast.trend} trend`,
      mitigation: getMitigationStrategies("penalty", penaltyForecast.riskFactors.factors),
    },
    consistencyForecast.riskFactors && {
      type: "Consistency",
      severity: consistencyForecast.riskFactors.level,
      description: `Consistency shows ${consistencyForecast.trend} trend`,
      mitigation: getMitigationStrategies("consistency", consistencyForecast.riskFactors.factors),
    },
  ].filter(Boolean) as Array<{
    type: string;
    severity: "low" | "medium" | "high";
    description: string;
    mitigation: string[];
  }>;

  const overallRisk = risks.length > 0
    ? risks.reduce((max, r) => {
        const severity = { low: 1, medium: 2, high: 3 }[r.severity];
        const currentMax = { low: 1, medium: 2, high: 3 }[max];
        return severity > currentMax ? r.severity : max;
      }, "low" as "low" | "medium" | "high")
    : "low";

  return {
    timeForecast,
    penaltyForecast,
    consistencyForecast,
    overallForecast,
    nextCompetitionPrediction,
    improvementOpportunities,
    riskAssessment: {
      overallRisk,
      risks,
    },
  };
}

/**
 * Determine overall confidence from multiple forecasts
 */
function determineOverallConfidence(forecasts: ForecastResult[]): "high" | "medium" | "low" {
  const confidenceScores = forecasts.map(f => {
    switch (f.confidence) {
      case "high": return 3;
      case "medium": return 2;
      case "low": return 1;
    }
  });
  const avgConfidence = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
  
  if (avgConfidence >= 2.5) return "high";
  if (avgConfidence >= 1.5) return "medium";
  return "low";
}

/**
 * Get mitigation strategies for risk factors
 */
function getMitigationStrategies(type: string, factors: string[]): string[] {
  const strategies: string[] = [];

  if (type === "time") {
    if (factors.includes("Performance declining")) {
      strategies.push("Review recent technique changes");
      strategies.push("Focus on fundamentals");
    }
    if (factors.includes("High performance variance")) {
      strategies.push("Standardize approach");
      strategies.push("Practice consistency drills");
    }
    strategies.push("Analyze split times for bottlenecks");
  } else if (type === "penalty") {
    strategies.push("Review penalty patterns");
    strategies.push("Focus on rule compliance training");
    strategies.push("Practice penalty-prone events");
  } else if (type === "consistency") {
    strategies.push("Standardize technique");
    strategies.push("Reduce variance through repetition");
    strategies.push("Focus on repeatability");
  }

  return strategies;
}

/**
 * Format forecast for display
 */
export function formatForecast(forecast: ForecastResult): string {
  const trendIcon = {
    improving: "↓",
    stable: "→",
    declining: "↑",
  }[forecast.trend];

  return `${forecast.forecast.toFixed(1)} ${trendIcon} (${forecast.confidenceInterval.lower.toFixed(1)} - ${forecast.confidenceInterval.upper.toFixed(1)})`;
}
