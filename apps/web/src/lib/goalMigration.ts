/**
 * Migration utility to move goals from localStorage to database
 */

import api from "./api";
import { Goal, dbGoalToGoal, goalToDbGoal } from "./goals";

/**
 * Check if there are goals in localStorage that need to be migrated
 */
export function hasLocalStorageGoals(): boolean {
  try {
    const stored = localStorage.getItem("waterways_goals");
    if (!stored) return false;
    const goals: Goal[] = JSON.parse(stored);
    return goals.length > 0;
  } catch {
    return false;
  }
}

/**
 * Migrate goals from localStorage to database
 * Returns the number of goals migrated
 */
export async function migrateGoalsToDatabase(): Promise<number> {
  try {
    const stored = localStorage.getItem("waterways_goals");
    if (!stored) return 0;

    const localGoals: Goal[] = JSON.parse(stored);
    if (localGoals.length === 0) return 0;

    let migrated = 0;
    const errors: string[] = [];

    // Migrate each goal
    for (const goal of localGoals) {
      try {
        // Check if goal already exists in database (by trying to create it)
        // If it fails due to duplicate, skip it
        await api.post("/goals", goalToDbGoal(goal));
        migrated++;
      } catch (error: any) {
        // If goal already exists (409 or similar), skip it
        if (error.response?.status === 409 || error.response?.status === 400) {
          console.log(`Goal "${goal.title}" already exists, skipping`);
          continue;
        }
        // Otherwise, log the error but continue
        errors.push(`Failed to migrate goal "${goal.title}": ${error.message}`);
        console.error(`Failed to migrate goal "${goal.title}":`, error);
      }
    }

    // If all goals were migrated successfully, clear localStorage
    if (migrated === localGoals.length && errors.length === 0) {
      localStorage.removeItem("waterways_goals");
      console.log(`✅ Successfully migrated ${migrated} goals to database`);
    } else if (migrated > 0) {
      console.log(`⚠️ Migrated ${migrated} of ${localGoals.length} goals. ${errors.length} errors.`);
      if (errors.length > 0) {
        console.error("Migration errors:", errors);
      }
    }

    return migrated;
  } catch (error) {
    console.error("Failed to migrate goals:", error);
    return 0;
  }
}

/**
 * Check if migration is needed and prompt user
 */
export async function checkAndMigrateGoals(): Promise<boolean> {
  if (!hasLocalStorageGoals()) {
    return false;
  }

  // Check if user wants to migrate
  const shouldMigrate = confirm(
    "We found goals stored locally. Would you like to migrate them to the database?\n\n" +
    "This will sync your goals across all devices. You can always migrate later."
  );

  if (shouldMigrate) {
    const migrated = await migrateGoalsToDatabase();
    if (migrated > 0) {
      alert(`Successfully migrated ${migrated} goal(s) to the database!`);
      return true;
    } else {
      alert("No goals were migrated. They may already exist in the database.");
      return false;
    }
  }

  return false;
}
