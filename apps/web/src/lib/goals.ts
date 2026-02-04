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
 * Database Goal type (with uppercase enums)
 */
export interface DbGoal {
  id: string;
  userId: string;
  type: "TIME" | "PENALTY" | "CONSISTENCY" | "COMPLETION";
  title: string;
  description?: string | null;
  target: number;
  current: number;
  unit: string;
  deadline?: string | null;
  seasonId?: string | null;
  progress: number;
  status: "ON_TRACK" | "AT_RISK" | "ACHIEVED" | "MISSED" | "NOT_STARTED";
  achievedAt?: string | null;
  autoUpdate: boolean;
  autoUpdateSource?: "MEDIAN_CLEAN_TIME" | "PENALTY_LOAD" | "CONSISTENCY_IQR" | "COMPLETION_RATE" | null;
  createdAt: string;
  updatedAt: string;
  season?: { id: string; name: string; year: number } | null;
  history?: DbGoalHistory[];
}

export interface DbGoalHistory {
  id: string;
  goalId: string;
  date: string;
  current: number;
  progress: number;
  status: "ON_TRACK" | "AT_RISK" | "ACHIEVED" | "MISSED" | "NOT_STARTED";
  note?: string | null;
}

/**
 * Convert database goal status to frontend format
 */
function dbStatusToStatus(dbStatus: string): GoalStatus {
  const map: Record<string, GoalStatus> = {
    "ON_TRACK": "on-track",
    "AT_RISK": "at-risk",
    "ACHIEVED": "achieved",
    "MISSED": "missed",
    "NOT_STARTED": "not-started",
  };
  return map[dbStatus] || "not-started";
}

/**
 * Convert frontend goal status to database format
 */
function statusToDbStatus(status: GoalStatus): string {
  const map: Record<GoalStatus, string> = {
    "on-track": "ON_TRACK",
    "at-risk": "AT_RISK",
    "achieved": "ACHIEVED",
    "missed": "MISSED",
    "not-started": "NOT_STARTED",
  };
  return map[status] || "NOT_STARTED";
}

/**
 * Convert database auto-update source to frontend format
 */
function dbAutoUpdateSourceToSource(dbSource: string | null | undefined): Goal["autoUpdateSource"] | undefined {
  if (!dbSource) return undefined;
  const map: Record<string, Goal["autoUpdateSource"]> = {
    "MEDIAN_CLEAN_TIME": "medianCleanTime",
    "PENALTY_LOAD": "penaltyLoad",
    "CONSISTENCY_IQR": "consistencyIQR",
    "COMPLETION_RATE": "completionRate",
  };
  return map[dbSource];
}

/**
 * Convert frontend auto-update source to database format
 */
function sourceToDbAutoUpdateSource(source: Goal["autoUpdateSource"] | undefined): string | null {
  if (!source) return null;
  const map: Record<string, string> = {
    "medianCleanTime": "MEDIAN_CLEAN_TIME",
    "penaltyLoad": "PENALTY_LOAD",
    "consistencyIQR": "CONSISTENCY_IQR",
    "completionRate": "COMPLETION_RATE",
  };
  return map[source] || null;
}

/**
 * Convert database goal to frontend goal format
 */
export function dbGoalToGoal(dbGoal: DbGoal): Goal {
  return {
    id: dbGoal.id,
    type: dbGoal.type.toLowerCase() as GoalType,
    title: dbGoal.title,
    description: dbGoal.description || undefined,
    target: dbGoal.target,
    current: dbGoal.current,
    unit: dbGoal.unit,
    deadline: dbGoal.deadline || undefined,
    seasonId: dbGoal.seasonId || undefined,
    createdAt: dbGoal.createdAt,
    updatedAt: dbGoal.updatedAt,
    progress: dbGoal.progress,
    status: dbStatusToStatus(dbGoal.status),
    history: dbGoal.history?.map(h => ({
      date: h.date,
      current: h.current,
      progress: h.progress,
      status: dbStatusToStatus(h.status),
      note: h.note || undefined,
    })),
    achievedAt: dbGoal.achievedAt || undefined,
    autoUpdate: dbGoal.autoUpdate,
    autoUpdateSource: dbAutoUpdateSourceToSource(dbGoal.autoUpdateSource),
  };
}

/**
 * Convert frontend goal to database format for API
 */
export function goalToDbGoal(goal: Partial<Goal>): any {
  return {
    ...(goal.type && { type: goal.type.toUpperCase() }),
    ...(goal.title && { title: goal.title }),
    ...(goal.description !== undefined && { description: goal.description || null }),
    ...(goal.target !== undefined && { target: goal.target }),
    ...(goal.current !== undefined && { current: goal.current }),
    ...(goal.unit && { unit: goal.unit }),
    ...(goal.deadline !== undefined && { deadline: goal.deadline || null }),
    ...(goal.seasonId !== undefined && { seasonId: goal.seasonId || null }),
    ...(goal.autoUpdate !== undefined && { autoUpdate: goal.autoUpdate }),
    ...(goal.autoUpdateSource !== undefined && { 
      autoUpdateSource: sourceToDbAutoUpdateSource(goal.autoUpdateSource)
    }),
  };
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
