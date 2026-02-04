/**
 * Goal Templates for Quick Creation
 */

import { GoalType } from "./goals";

export interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  type: GoalType;
  defaultTarget: number;
  defaultUnit: string;
  category: "performance" | "penalty" | "consistency" | "completion";
  icon: string;
}

export const goalTemplates: GoalTemplate[] = [
  {
    id: "time_median_120",
    name: "Achieve 120s Median Clean Time",
    description: "Reduce your median clean time to 120 seconds",
    type: "time",
    defaultTarget: 120,
    defaultUnit: "seconds",
    category: "performance",
    icon: "⏱️",
  },
  {
    id: "time_median_100",
    name: "Achieve 100s Median Clean Time",
    description: "Reduce your median clean time to 100 seconds",
    type: "time",
    defaultTarget: 100,
    defaultUnit: "seconds",
    category: "performance",
    icon: "⏱️",
  },
  {
    id: "penalty_reduce_10",
    name: "Reduce Total Penalties to 10s",
    description: "Reduce total penalty time to 10 seconds per competition",
    type: "penalty",
    defaultTarget: 10,
    defaultUnit: "seconds",
    category: "penalty",
    icon: "⚠️",
  },
  {
    id: "penalty_reduce_5",
    name: "Reduce Total Penalties to 5s",
    description: "Reduce total penalty time to 5 seconds per competition",
    type: "penalty",
    defaultTarget: 5,
    defaultUnit: "seconds",
    category: "penalty",
    icon: "⚠️",
  },
  {
    id: "consistency_iqr_5",
    name: "Improve Consistency to IQR of 5s",
    description: "Achieve an Interquartile Range (IQR) of 5 seconds for better consistency",
    type: "consistency",
    defaultTarget: 5,
    defaultUnit: "seconds (IQR)",
    category: "consistency",
    icon: "📊",
  },
  {
    id: "consistency_iqr_3",
    name: "Improve Consistency to IQR of 3s",
    description: "Achieve an Interquartile Range (IQR) of 3 seconds for excellent consistency",
    type: "consistency",
    defaultTarget: 3,
    defaultUnit: "seconds (IQR)",
    category: "consistency",
    icon: "📊",
  },
  {
    id: "completion_90",
    name: "Achieve 90% Completion Rate",
    description: "Complete 90% of planned runs successfully",
    type: "completion",
    defaultTarget: 90,
    defaultUnit: "percentage",
    category: "completion",
    icon: "✅",
  },
  {
    id: "completion_95",
    name: "Achieve 95% Completion Rate",
    description: "Complete 95% of planned runs successfully",
    type: "completion",
    defaultTarget: 95,
    defaultUnit: "percentage",
    category: "completion",
    icon: "✅",
  },
];

export function getTemplatesByCategory(category?: string): GoalTemplate[] {
  if (!category) return goalTemplates;
  return goalTemplates.filter(t => t.category === category);
}
