/**
 * Auto-update goals from performance data
 */

import { Goal, GoalType, calculateProgress, calculateStatus } from "./goals";
import type { CompetitionTrend } from "@waterways/shared";

/**
 * Update goal current value from performance data
 */
export function updateGoalFromPerformance(
  goal: Goal,
  trends: CompetitionTrend[]
): Goal {
  if (!goal.autoUpdate || !goal.autoUpdateSource || trends.length === 0) {
    return goal;
  }

  const latestTrend = trends[trends.length - 1];
  let newCurrent = goal.current;

  switch (goal.autoUpdateSource) {
    case "medianCleanTime":
      newCurrent = latestTrend.medianCleanTime;
      break;
    case "penaltyLoad":
      newCurrent = latestTrend.penaltyLoad;
      break;
    case "consistencyIQR":
      newCurrent = latestTrend.consistencyIQR;
      break;
    case "completionRate":
      // Calculate completion rate from trends
      const totalRuns = trends.reduce((sum, t) => sum + t.runCount, 0);
      const completedRuns = trends.filter(t => t.runCount > 0).length;
      newCurrent = totalRuns > 0 ? (completedRuns / trends.length) * 100 : 0;
      break;
    default:
      return goal;
  }

  // Only update if value changed
  if (Math.abs(newCurrent - goal.current) < 0.01) {
    return goal;
  }

  const previousStatus = goal.status;
  const previousProgress = goal.progress;
  const newProgress = calculateProgress(newCurrent, goal.target, goal.type);
  const newStatus = calculateStatus(newProgress, goal.deadline, goal.type);

  // Add to history
  const historyEntry = {
    date: new Date().toISOString(),
    current: newCurrent,
    progress: newProgress,
    status: newStatus,
    note: `Auto-updated from ${goal.autoUpdateSource}`,
  };

  const history = goal.history || [];
  history.push(historyEntry);

  // Keep only last 50 entries
  const trimmedHistory = history.slice(-50);

  // Check if goal was just achieved
  const wasJustAchieved = previousStatus !== "achieved" && newStatus === "achieved";

  return {
    ...goal,
    current: newCurrent,
    progress: newProgress,
    status: newStatus,
    history: trimmedHistory,
    updatedAt: new Date().toISOString(),
    achievedAt: wasJustAchieved ? new Date().toISOString() : goal.achievedAt,
  };
}

/**
 * Update all auto-update goals from performance data
 */
export function updateAllAutoUpdateGoals(
  goals: Goal[],
  trends: CompetitionTrend[]
): Goal[] {
  return goals.map(goal => updateGoalFromPerformance(goal, trends));
}

/**
 * Get suggested auto-update source for a goal type
 * (Also exported from goals.ts for convenience)
 */
export function getSuggestedAutoUpdateSource(type: GoalType): Goal["autoUpdateSource"] {
  switch (type) {
    case "time":
      return "medianCleanTime";
    case "penalty":
      return "penaltyLoad";
    case "consistency":
      return "consistencyIQR";
    case "completion":
      return "completionRate";
    default:
      return undefined;
  }
}
