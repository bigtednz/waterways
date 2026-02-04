import { useState, useEffect } from "react";
import { Goal, GoalType, calculateProgress, calculateStatus } from "../lib/goals";
import { GoalCard } from "./GoalCard";
import { GoalForm } from "./GoalForm";
import { GoalTemplateSelector } from "./GoalTemplateSelector";
import { updateAllAutoUpdateGoals } from "../lib/goalAutoUpdate";
import { showGoalAchievement } from "../lib/goalNotifications";
import api from "../lib/api";
import type { CompetitionTrend } from "@waterways/shared";

interface GoalsManagerProps {
  seasonId?: string | null;
  onGoalUpdate?: () => void;
  competitionTrends?: CompetitionTrend[]; // For auto-update
}

export function GoalsManager({ seasonId, onGoalUpdate, competitionTrends = [] }: GoalsManagerProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();
  const [seasons, setSeasons] = useState<Array<{ id: string; name: string; year: number }>>([]);

  // Load seasons
  useEffect(() => {
    api.get("/seasons")
      .then((res) => setSeasons(res.data))
      .catch(() => setSeasons([]));
  }, []);

  // Load goals (using localStorage for now - can be replaced with API)
  useEffect(() => {
    setLoading(true);
    try {
      const stored = localStorage.getItem("waterways_goals");
      if (stored) {
        const allGoals: Goal[] = JSON.parse(stored);
        // Filter by season if provided
        const filtered = seasonId
          ? allGoals.filter(g => !g.seasonId || g.seasonId === seasonId)
          : allGoals;
        
        // Update progress and status for each goal
        // Ensure all optional fields exist for backward compatibility
        let updatedGoals = filtered.map(goal => {
          const progress = calculateProgress(goal.current, goal.target, goal.type);
          const status = calculateStatus(progress, goal.deadline, goal.type);
          return { 
            ...goal, 
            progress, 
            status,
            history: goal.history || [],
            autoUpdate: goal.autoUpdate || false,
            autoUpdateSource: goal.autoUpdateSource,
            achievedAt: goal.achievedAt,
          } as Goal;
        });
        
        // Auto-update goals from performance data
        if (competitionTrends.length > 0) {
          const previousGoals = [...updatedGoals];
          updatedGoals = updateAllAutoUpdateGoals(updatedGoals, competitionTrends);
          
          // Check for newly achieved goals and show notifications
          updatedGoals.forEach((goal, index) => {
            const previous = previousGoals[index];
            if (previous && previous.status !== "achieved" && goal.status === "achieved") {
              showGoalAchievement(goal);
            }
          });
          
          // Save updated goals back to localStorage if auto-updates occurred
          try {
            const stored = localStorage.getItem("waterways_goals");
            if (stored) {
              const allGoals: Goal[] = JSON.parse(stored);
              const updatedAllGoals = allGoals.map(g => {
                const updated = updatedGoals.find(ug => ug.id === g.id);
                return updated || g;
              });
              localStorage.setItem("waterways_goals", JSON.stringify(updatedAllGoals));
            }
          } catch (e) {
            console.error("Failed to save auto-updated goals:", e);
          }
        }
        
        setGoals(updatedGoals);
      }
    } catch (error) {
      console.error("Failed to load goals:", error);
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, [seasonId, competitionTrends]);

  const saveGoal = (goalData: Omit<Goal, "id" | "createdAt" | "updatedAt" | "progress" | "status" | "history" | "achievedAt">) => {
    try {
      const stored = localStorage.getItem("waterways_goals");
      const allGoals: Goal[] = stored ? JSON.parse(stored) : [];
      
      const progress = calculateProgress(goalData.current, goalData.target, goalData.type);
      const status = calculateStatus(progress, goalData.deadline, goalData.type);
      
      if (editingGoal) {
        // Update existing goal - preserve history
        const existingGoal = allGoals.find(g => g.id === editingGoal.id);
        const history = existingGoal?.history || [];
        
        // Add history entry if current value changed
        if (existingGoal && Math.abs(existingGoal.current - goalData.current) > 0.01) {
          history.push({
            date: new Date().toISOString(),
            current: goalData.current,
            progress,
            status,
            note: "Manual update",
          });
        }
        
        const updated = allGoals.map(g =>
          g.id === editingGoal.id
            ? {
                ...g,
                ...goalData,
                progress,
                status,
                history: history.slice(-50), // Keep last 50 entries
                updatedAt: new Date().toISOString(),
                achievedAt: g.status !== "achieved" && status === "achieved" 
                  ? new Date().toISOString() 
                  : g.achievedAt,
              } as Goal
            : g
        );
        localStorage.setItem("waterways_goals", JSON.stringify(updated));
      } else {
        // Create new goal
        const newGoal: Goal = {
          id: `goal_${Date.now()}`,
          ...goalData,
          progress,
          status,
          history: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem("waterways_goals", JSON.stringify([...allGoals, newGoal]));
      }
      
      // Reload goals
      const updated = localStorage.getItem("waterways_goals");
      if (updated) {
        const allGoals: Goal[] = JSON.parse(updated);
        const filtered = seasonId
          ? allGoals.filter(g => !g.seasonId || g.seasonId === seasonId)
          : allGoals;
        const updatedGoals = filtered.map(goal => {
          const p = calculateProgress(goal.current, goal.target, goal.type);
          const s = calculateStatus(p, goal.deadline, goal.type);
          return { ...goal, progress: p, status: s };
        });
        setGoals(updatedGoals);
      }
      
      setShowForm(false);
      setEditingGoal(undefined);
      onGoalUpdate?.();
    } catch (error) {
      console.error("Failed to save goal:", error);
      alert("Failed to save goal. Please try again.");
    }
  };

  const deleteGoal = (goalId: string) => {
    if (!confirm("Are you sure you want to delete this goal?")) return;
    
    try {
      const stored = localStorage.getItem("waterways_goals");
      if (stored) {
        const allGoals: Goal[] = JSON.parse(stored);
        const updated = allGoals.filter(g => g.id !== goalId);
        localStorage.setItem("waterways_goals", JSON.stringify(updated));
        setGoals(goals.filter(g => g.id !== goalId));
        onGoalUpdate?.();
      }
    } catch (error) {
      console.error("Failed to delete goal:", error);
      alert("Failed to delete goal. Please try again.");
    }
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setShowForm(true);
  };

  const handleNewGoal = () => {
    setEditingGoal(undefined);
    setShowForm(true);
    setShowTemplates(false);
  };

  const handleUseTemplate = (template: { name: string; description: string; type: GoalType; defaultTarget: number; defaultUnit: string }) => {
    // Create goal from template
    const newGoal: Omit<Goal, "id" | "createdAt" | "updatedAt" | "progress" | "status"> = {
      title: template.name,
      description: template.description,
      type: template.type,
      target: template.defaultTarget,
      current: 0, // User should set this
      unit: template.defaultUnit,
      seasonId: seasonId || undefined,
    };
    
    saveGoal(newGoal);
    setShowTemplates(false);
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading goals...</div>;
  }

  if (showForm) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingGoal ? "Edit Goal" : "Create New Goal"}
          </h2>
          <button
            onClick={() => {
              setShowForm(false);
              setEditingGoal(undefined);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <GoalForm
          goal={editingGoal}
          onSave={saveGoal}
          onCancel={() => {
            setShowForm(false);
            setEditingGoal(undefined);
          }}
          seasons={seasons}
        />
      </div>
    );
  }

  const activeGoals = goals.filter(g => g.status !== "achieved" && g.status !== "missed");
  const achievedGoals = goals.filter(g => g.status === "achieved");
  const otherGoals = goals.filter(g => g.status === "missed" || g.status === "not-started");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Goals & Targets</h2>
          <p className="text-gray-600 mt-1">Set and track your performance goals</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
          >
            📋 Templates
          </button>
          <button
            onClick={handleNewGoal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            + New Goal
          </button>
        </div>
      </div>

      {showTemplates && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-purple-200 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Goal Templates</h3>
            <button
              onClick={() => setShowTemplates(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <GoalTemplateSelector onSelect={handleUseTemplate} />
        </div>
      )}

      {goals.length === 0 ? (
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Goals Yet</h3>
          <p className="text-gray-600 mb-6">
            Set your first goal to start tracking your progress and improving performance.
          </p>
          <button
            onClick={handleNewGoal}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Create Your First Goal
          </button>
        </div>
      ) : (
        <>
          {activeGoals.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Active Goals ({activeGoals.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={handleEdit}
                    onDelete={deleteGoal}
                  />
                ))}
              </div>
            </div>
          )}

          {achievedGoals.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                🏆 Achieved Goals ({achievedGoals.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {achievedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={handleEdit}
                    onDelete={deleteGoal}
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          {otherGoals.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Other Goals ({otherGoals.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {otherGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onEdit={handleEdit}
                    onDelete={deleteGoal}
                    compact
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
