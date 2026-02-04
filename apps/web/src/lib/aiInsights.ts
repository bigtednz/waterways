/**
 * AI-Powered Insights for Competition Day
 */

interface QueueItem {
  id: string;
  sequenceNo: number;
  eventCode: string;
  status: "PLANNED" | "RUN" | "SKIPPED";
  attemptNo: number;
  totalTimeSeconds?: number | null;
  penaltySeconds?: number | null;
  notes?: string;
}

interface HistoricalData {
  eventCode: string;
  avgTime: number;
  bestTime: number;
  avgPenalty: number;
  completionRate: number;
}

export interface Insight {
  type: "prediction" | "anomaly" | "suggestion" | "coaching" | "strategy" | "risk";
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  itemId?: string;
  priority?: number; // 1-10, higher = more important
  impact?: "high" | "medium" | "low";
  confidence?: number; // 0-1, how certain is this insight
  estimatedImprovement?: string; // e.g., "Could save 5-10 seconds"
  actionItems?: string[]; // Specific actions to take
  relatedEventCodes?: string[]; // Related events
  category?: "performance" | "penalty" | "strategy" | "coaching" | "risk";
}

/**
 * Predict time for an event based on historical data
 */
export function predictTime(
  eventCode: string,
  historicalData: HistoricalData[]
): number | null {
  const history = historicalData.find((h) => h.eventCode === eventCode);
  if (!history) return null;
  
  // Weighted average: 70% average time, 30% best time
  return history.avgTime * 0.7 + history.bestTime * 0.3;
}

/**
 * Detect anomalies in times
 */
export function detectAnomalies(
  items: QueueItem[],
  historicalData: HistoricalData[]
): Insight[] {
  const insights: Insight[] = [];
  
  items.forEach((item) => {
    if (!item.totalTimeSeconds) return;
    
    const history = historicalData.find((h) => h.eventCode === item.eventCode);
    if (!history) return;
    
    const predicted = predictTime(item.eventCode, historicalData);
    if (!predicted) return;
    
    const deviation = Math.abs(item.totalTimeSeconds - predicted);
    const threshold = predicted * 0.15; // 15% deviation threshold
    
    if (deviation > threshold) {
      const isSlow = item.totalTimeSeconds > predicted;
      const deviationPercent = (deviation / predicted) * 100;
      insights.push({
        type: "anomaly",
        title: `${isSlow ? "Slower" : "Faster"} than expected`,
        message: `${item.eventCode} time (${item.totalTimeSeconds.toFixed(2)}s) is ${deviationPercent.toFixed(1)}% ${isSlow ? "slower" : "faster"} than predicted (${predicted.toFixed(2)}s)`,
        severity: isSlow ? "warning" : "info",
        itemId: item.id,
        priority: isSlow ? Math.min(10, Math.round(5 + deviationPercent / 5)) : 3,
        impact: deviationPercent > 20 ? "high" : deviationPercent > 10 ? "medium" : "low",
        confidence: 0.8,
        category: "performance",
        actionItems: isSlow ? [
          "Review technique for this event",
          "Check for equipment issues",
          "Consider taking a break if fatigue is a factor"
        ] : [
          "Celebrate exceptional performance!",
          "Review what made this run successful",
          "Consider applying similar approach to other events"
        ],
        relatedEventCodes: [item.eventCode],
      });
    }
    
    // Check for unusually high penalties
    if (item.penaltySeconds && item.penaltySeconds > history.avgPenalty * 2) {
      const penaltyRatio = item.penaltySeconds / history.avgPenalty;
      const potentialSavings = item.penaltySeconds - history.avgPenalty;
      insights.push({
        type: "anomaly",
        title: "High penalty detected",
        message: `${item.eventCode} has ${item.penaltySeconds.toFixed(2)}s penalty, which is ${((penaltyRatio - 1) * 100).toFixed(0)}% above average (${history.avgPenalty.toFixed(2)}s)`,
        severity: "warning",
        itemId: item.id,
        priority: Math.min(10, Math.round(6 + penaltyRatio)),
        impact: penaltyRatio > 3 ? "high" : penaltyRatio > 2 ? "medium" : "low",
        confidence: 0.9,
        estimatedImprovement: `Could save ${potentialSavings.toFixed(1)}s by reducing penalties to average`,
        category: "penalty",
        actionItems: [
          "Review penalty rules for this event",
          "Focus training on penalty reduction",
          "Analyze what caused the high penalties"
        ],
        relatedEventCodes: [item.eventCode],
      });
    }
  });
  
  return insights;
}

/**
 * Suggest optimal run order
 */
export function suggestOptimalOrder(
  items: QueueItem[],
  historicalData: HistoricalData[]
): Insight[] {
  const insights: Insight[] = [];
  
  // Group by status
  const planned = items.filter((i) => i.status === "PLANNED");
  
  if (planned.length === 0) return insights;
  
  // Calculate average difficulty (based on historical completion rates)
  const difficulty = planned.map((item) => {
    const history = historicalData.find((h) => h.eventCode === item.eventCode);
    return {
      item,
      difficulty: history ? 1 - history.completionRate : 0.5, // Higher = harder
    };
  });
  
  // Sort by difficulty (easiest first)
  difficulty.sort((a, b) => a.difficulty - b.difficulty);
  
  const currentOrder = planned.map((item) => item.sequenceNo);
  const suggestedOrder = difficulty.map((d) => d.item.sequenceNo);
  
  // Check if order differs significantly
  const orderDiff = currentOrder.some((seq, idx) => seq !== suggestedOrder[idx]);
  
  if (orderDiff) {
    const currentTotal = planned.reduce((sum, item) => {
      const history = historicalData.find((h) => h.eventCode === item.eventCode);
      return sum + (history ? history.avgTime : 0);
    }, 0);
    
    const suggestedTotal = difficulty.reduce((sum, d) => {
      const history = historicalData.find((h) => h.eventCode === d.item.eventCode);
      return sum + (history ? history.avgTime : 0);
    }, 0);
    
    const potentialSavings = currentTotal - suggestedTotal;
    
    insights.push({
      type: "suggestion",
      title: "Optimal run order suggestion",
      message: `Consider running easier events first. Suggested order: ${difficulty.map((d) => d.item.eventCode).join(", ")}`,
      severity: "info",
      priority: potentialSavings > 30 ? 8 : potentialSavings > 15 ? 6 : 4,
      impact: potentialSavings > 30 ? "high" : potentialSavings > 15 ? "medium" : "low",
      confidence: 0.7,
      estimatedImprovement: potentialSavings > 0 ? `Could save ~${potentialSavings.toFixed(0)}s with optimal order` : undefined,
      category: "strategy",
      actionItems: [
        "Reorder runs to start with easier events",
        "This can help build confidence and momentum",
        "Consider energy management throughout the day"
      ],
      relatedEventCodes: difficulty.map((d) => d.item.eventCode),
    });
  }
  
  return insights;
}

/**
 * Generate coaching tips
 */
export function generateCoachingTips(
  items: QueueItem[],
  _historicalData: HistoricalData[]
): Insight[] {
  const insights: Insight[] = [];
  
  const completed = items.filter((i) => i.status === "RUN" && i.totalTimeSeconds);
  if (completed.length === 0) return insights;
  
  // Find events with declining performance
  const recent = completed.slice(-5);
  const earlier = completed.slice(0, -5);
  
  if (earlier.length > 0) {
    const recentAvg = recent.reduce((sum, i) => sum + (i.totalTimeSeconds || 0), 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, i) => sum + (i.totalTimeSeconds || 0), 0) / earlier.length;
    
    if (recentAvg > earlierAvg * 1.1) {
      const declinePercent = ((recentAvg - earlierAvg) / earlierAvg) * 100;
      insights.push({
        type: "coaching",
        title: "Performance declining - Fatigue detected",
        message: `Recent runs are ${declinePercent.toFixed(1)}% slower on average. This suggests fatigue may be setting in.`,
        severity: "warning",
        priority: declinePercent > 20 ? 9 : declinePercent > 15 ? 7 : 5,
        impact: declinePercent > 20 ? "high" : declinePercent > 15 ? "medium" : "low",
        confidence: 0.85,
        estimatedImprovement: "Taking a break could restore performance to earlier levels",
        category: "coaching",
        actionItems: [
          "Consider taking a 10-15 minute break",
          "Review hydration and nutrition",
          "Focus on maintaining technique, not speed",
          "Consider adjusting remaining run order"
        ],
      });
    }
  }
  
  // Check for penalty patterns
  const highPenaltyEvents = completed.filter(
    (i) => i.penaltySeconds && i.penaltySeconds > 10
  );
  
  if (highPenaltyEvents.length > 0) {
    const eventCodes = [...new Set(highPenaltyEvents.map((i) => i.eventCode))];
    const totalPenaltyTime = highPenaltyEvents.reduce((sum, i) => sum + (i.penaltySeconds || 0), 0);
    const avgPenaltyPerEvent = totalPenaltyTime / highPenaltyEvents.length;
    
    insights.push({
      type: "coaching",
      title: "Penalty focus needed",
      message: `High penalties detected in: ${eventCodes.join(", ")}. Average penalty: ${avgPenaltyPerEvent.toFixed(1)}s per event.`,
      severity: "warning",
      priority: avgPenaltyPerEvent > 15 ? 8 : avgPenaltyPerEvent > 10 ? 6 : 4,
      impact: avgPenaltyPerEvent > 15 ? "high" : avgPenaltyPerEvent > 10 ? "medium" : "low",
      confidence: 0.9,
      estimatedImprovement: `Reducing penalties to average could save ${(totalPenaltyTime * 0.5).toFixed(0)}s+`,
      category: "penalty",
      actionItems: [
        `Review penalty rules for: ${eventCodes.join(", ")}`,
        "Focus training on these event types",
        "Practice penalty avoidance techniques",
        "Consider penalty reduction drills"
      ],
      relatedEventCodes: eventCodes,
    });
  }
  
  // Check for consistency
  const times = completed.map((i) => i.totalTimeSeconds || 0);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);
  const coefficient = stdDev / avg;
  
  if (coefficient > 0.15) {
    insights.push({
      type: "coaching",
      title: "Inconsistent performance",
      message: `Time variance is high (coefficient: ${coefficient.toFixed(2)}). Focus on consistent technique and pacing.`,
      severity: "info",
      priority: coefficient > 0.25 ? 7 : 5,
      impact: coefficient > 0.25 ? "high" : "medium",
      confidence: 0.8,
      estimatedImprovement: "Improving consistency could reduce time variance by 30-50%",
      category: "coaching",
      actionItems: [
        "Focus on consistent technique across all runs",
        "Maintain steady pacing throughout",
        "Review and standardize approach",
        "Practice consistency drills"
      ],
    });
  }
  
  return insights;
}

/**
 * Generate predictive insights for upcoming runs
 */
export function generatePredictiveInsights(
  items: QueueItem[],
  historicalData: HistoricalData[]
): Insight[] {
  const insights: Insight[] = [];
  const planned = items.filter((i) => i.status === "PLANNED");
  
  if (planned.length === 0) return insights;
  
  // Predict times for upcoming runs
  planned.forEach((item) => {
    const predicted = predictTime(item.eventCode, historicalData);
    if (predicted) {
      const history = historicalData.find((h) => h.eventCode === item.eventCode);
      if (history) {
        insights.push({
          type: "prediction",
          title: `Predicted time for ${item.eventCode}`,
          message: `Expected time: ${predicted.toFixed(1)}s (based on your historical average of ${history.avgTime.toFixed(1)}s and best of ${history.bestTime.toFixed(1)}s)`,
          severity: "info",
          priority: 3,
          impact: "low",
          confidence: 0.7,
          category: "performance",
          relatedEventCodes: [item.eventCode],
        });
      }
    }
  });
  
  return insights;
}

/**
 * Generate risk assessment insights
 */
export function generateRiskInsights(
  items: QueueItem[],
  _historicalData: HistoricalData[]
): Insight[] {
  const insights: Insight[] = [];
  const completed = items.filter((i) => i.status === "RUN" && i.totalTimeSeconds);
  const planned = items.filter((i) => i.status === "PLANNED");
  
  if (completed.length < 3 || planned.length === 0) return insights;
  
  // Calculate completion rate
  const completionRate = completed.length / items.length;
  if (completionRate < 0.3 && items.length > 5) {
    insights.push({
      type: "risk",
      title: "Low completion rate - Pace concern",
      message: `Only ${(completionRate * 100).toFixed(0)}% of runs completed. At current pace, may not finish on time.`,
      severity: "warning",
      priority: 8,
      impact: "high",
      confidence: 0.75,
      category: "risk",
      actionItems: [
        "Consider increasing pace",
        "Review if any runs can be skipped",
        "Plan breaks strategically",
        "Monitor time remaining closely"
      ],
    });
  }
  
  // Check for fatigue risk
  if (completed.length >= 5) {
    const recent = completed.slice(-3);
    const earlier = completed.slice(0, 3);
    const recentAvg = recent.reduce((sum, i) => sum + (i.totalTimeSeconds || 0), 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, i) => sum + (i.totalTimeSeconds || 0), 0) / earlier.length;
    
    if (recentAvg > earlierAvg * 1.15) {
      insights.push({
        type: "risk",
        title: "Fatigue risk detected",
        message: `Recent runs are ${(((recentAvg - earlierAvg) / earlierAvg) * 100).toFixed(0)}% slower. Fatigue may impact remaining runs.`,
        severity: "warning",
        priority: 7,
        impact: "high",
        confidence: 0.8,
        category: "risk",
        actionItems: [
          "Take a break before next run",
          "Review hydration and energy levels",
          "Consider adjusting remaining run order",
          "Focus on technique over speed"
        ],
      });
    }
  }
  
  return insights;
}

/**
 * Get all insights for a competition day
 */
export function getAllInsights(
  items: QueueItem[],
  historicalData: HistoricalData[]
): Insight[] {
  if (!items || !Array.isArray(items)) {
    return [];
  }
  
  const insights: Insight[] = [];
  
  try {
    insights.push(...detectAnomalies(items, historicalData));
    insights.push(...suggestOptimalOrder(items, historicalData));
    insights.push(...generateCoachingTips(items, historicalData));
    insights.push(...generatePredictiveInsights(items, historicalData));
    insights.push(...generateRiskInsights(items, historicalData));
    
    // Sort by priority (highest first), then by impact
    insights.sort((a, b) => {
      const priorityA = a.priority || 0;
      const priorityB = b.priority || 0;
      if (priorityA !== priorityB) return priorityB - priorityA;
      
      const impactOrder = { high: 3, medium: 2, low: 1 };
      const impactA = impactOrder[a.impact || "low"];
      const impactB = impactOrder[b.impact || "low"];
      return impactB - impactA;
    });
  } catch (error) {
    console.error("Error generating insights:", error);
    // Return empty array on error
  }
  
  return insights;
}
