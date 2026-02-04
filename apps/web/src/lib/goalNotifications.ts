/**
 * Goal Achievement Notifications
 */

import { Goal } from "./goals";
import { getGoalTypeIcon } from "./goals";
import { toast } from "./toast";

/**
 * Show celebration notification when goal is achieved
 */
export function showGoalAchievement(goal: Goal) {
  // Use the existing toast system for consistency
  const icon = getGoalTypeIcon(goal.type);
  toast.success(
    `🎉 Goal Achieved! ${icon} ${goal.title} - You've reached your target!`,
    7000 // Show for 7 seconds for achievements
  );
}
