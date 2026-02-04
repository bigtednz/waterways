/**
 * Goal Setting & Tracking System
 */

export type GoalType = "time" | "penalty" | "consistency" | "completion";
export type GoalStatus = "on-track" | "at-risk" | "achieved" | "missed" | "not-started";

export interface Goal {
  id: string;
  type: GoalType;
  title: string;
  description?: string;
  target: number;
  current: number;
  unit: string; // "seconds", "percentage", "count", etc.
  deadline?: string; // ISO date string
  seasonId?: string;
  createdAt: string;
  updatedAt: string;
  progress: number; // 0-100
  status: GoalStatus;
  history?: GoalHistoryEntry[]; // Track changes over time
  achievedAt?: string; // When goal was achieved
  autoUpdate?: boolean; // Whether to auto-update from performance data
  autoUpdateSource?: "medianCleanTime" | "penaltyLoad" | "consistencyIQR" | "completionRate";
}

export interface GoalHistoryEntry {
  date: string;
  current: number;
  progress: number;
  status: GoalStatus;
  note?: string;
}

/**
 * Calculate goal progress (0-100)
 */
export function calculateProgress(current: number, target: number, type: GoalType): number {
  if (target === 0) return 0;
  
  switch (type) {
    case "time":
      // For time goals, lower is better (target is minimum time)
      // Progress = how close current is to target (0% if current > target * 1.2, 100% if current <= target)
      if (current <= target) return 100;
      const maxTime = target * 1.2; // 20% buffer
      if (current >= maxTime) return 0;
      return Math.max(0, Math.min(100, ((maxTime - current) / (maxTime - target)) * 100));
    
    case "penalty":
      // For penalty goals, lower is better
      if (current <= target) return 100;
      const maxPenalty = target * 2; // 100% buffer
      if (current >= maxPenalty) return 0;
      return Math.max(0, Math.min(100, ((maxPenalty - current) / (maxPenalty - target)) * 100));
    
    case "consistency":
      // For consistency (IQR), lower is better
      if (current <= target) return 100;
      const maxIQR = target * 1.5; // 50% buffer
      if (current >= maxIQR) return 0;
      return Math.max(0, Math.min(100, ((maxIQR - current) / (maxIQR - target)) * 100));
    
    case "completion":
      // For completion, higher is better
      if (current >= target) return 100;
      return Math.max(0, Math.min(100, (current / target) * 100));
    
    default:
      return 0;
  }
}

/**
 * Determine goal status based on progress and deadline
 */
export function calculateStatus(
  progress: number,
  deadline?: string,
  type: GoalType = "time"
): GoalStatus {
  if (progress >= 100) return "achieved";
  
  if (!deadline) {
    // No deadline - status based on progress
    if (progress >= 75) return "on-track";
    if (progress >= 50) return "at-risk";
    return "not-started";
  }
  
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const daysRemaining = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  
  // Calculate expected progress based on time elapsed
  const totalDays = deadlineDate.getTime() - new Date(deadline).getTime();
  const daysElapsed = totalDays - daysRemaining;
  const expectedProgress = daysElapsed > 0 ? (daysElapsed / totalDays) * 100 : 0;
  
  if (progress >= 100) return "achieved";
  if (daysRemaining < 0 && progress < 100) return "missed";
  if (progress >= expectedProgress * 0.9) return "on-track";
  if (progress >= expectedProgress * 0.5) return "at-risk";
  return "not-started";
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: GoalStatus): string {
  switch (status) {
    case "achieved":
      return "bg-green-500";
    case "on-track":
      return "bg-blue-500";
    case "at-risk":
      return "bg-yellow-500";
    case "missed":
      return "bg-red-500";
    case "not-started":
      return "bg-gray-400";
    default:
      return "bg-gray-400";
  }
}

/**
 * Get status text for UI
 */
export function getStatusText(status: GoalStatus): string {
  switch (status) {
    case "achieved":
      return "Achieved";
    case "on-track":
      return "On Track";
    case "at-risk":
      return "At Risk";
    case "missed":
      return "Missed";
    case "not-started":
      return "Not Started";
    default:
      return "Unknown";
  }
}

/**
 * Format goal value for display
 */
export function formatGoalValue(value: number, type: GoalType, unit: string): string {
  switch (type) {
    case "time":
      return `${value.toFixed(1)}s`;
    case "penalty":
      return `${value.toFixed(1)}s`;
    case "consistency":
      return `${value.toFixed(1)}s`;
    case "completion":
      return `${value.toFixed(0)}%`;
    default:
      return `${value.toFixed(1)} ${unit}`;
  }
}

/**
 * Get goal type display name
 */
export function getGoalTypeName(type: GoalType): string {
  switch (type) {
    case "time":
      return "Time Target";
    case "penalty":
      return "Penalty Reduction";
    case "consistency":
      return "Consistency";
    case "completion":
      return "Completion Rate";
    default:
      return "Goal";
  }
}

/**
 * Get goal type icon
 */
export function getGoalTypeIcon(type: GoalType): string {
  switch (type) {
    case "time":
      return "⏱️";
    case "penalty":
      return "⚠️";
    case "consistency":
      return "📊";
    case "completion":
      return "✅";
    default:
      return "🎯";
  }
}

/**
 * Get suggested auto-update source for a goal type
 * (Re-exported from goalAutoUpdate for convenience)
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
