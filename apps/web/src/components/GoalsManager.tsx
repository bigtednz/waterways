import { useState, useEffect } from "react";
import { Goal, GoalType, dbGoalToGoal, goalToDbGoal } from "../lib/goals";
import { GoalCard } from "./GoalCard";
import { GoalForm } from "./GoalForm";
import { GoalTemplateSelector } from "./GoalTemplateSelector";
import { updateAllAutoUpdateGoals } from "../lib/goalAutoUpdate";
import { showGoalAchievement } from "../lib/goalNotifications";
import { checkAndMigrateGoals } from "../lib/goalMigration";
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

  // Check for localStorage goals migration on mount
  useEffect(() => {
    // Only run migration check if the function is available
    if (typeof checkAndMigrateGoals === 'function') {
      checkAndMigrateGoals().catch(console.error);
    }
  }, []);

  // Load goals from API (with fallback to localStorage if API not available)
  useEffect(() => {
    setLoading(true);
    const loadGoals = async () => {
      try {
        const params = seasonId ? { seasonId } : {};
        const response = await api.get("/goals", { params });
        const dbGoals = response.data || [];
        // Ensure dbGoals is an array before mapping
        if (!Array.isArray(dbGoals)) {
          throw new Error("Invalid response format from API");
        }
        const frontendGoals: Goal[] = dbGoals.map(dbGoalToGoal);
        
        // Auto-update goals from performance data
        if (competitionTrends.length > 0) {
          const previousGoals = [...frontendGoals];
          const updatedGoals = updateAllAutoUpdateGoals(frontendGoals, competitionTrends);
          
          // Check for newly achieved goals and show notifications
          updatedGoals.forEach((goal, index) => {
            const previous = previousGoals[index];
            if (previous && previous.status !== "achieved" && goal.status === "achieved") {
              showGoalAchievement(goal);
            }
          });
          
          // Save auto-updated goals back to API
          for (const goal of updatedGoals) {
            const previous = previousGoals.find(p => p.id === goal.id);
            if (previous && (
              Math.abs(previous.current - goal.current) > 0.01 ||
              previous.status !== goal.status
            )) {
              // Goal was auto-updated, save to API
              try {
                await api.put(`/goals/${goal.id}`, goalToDbGoal({
                  current: goal.current,
                }));
              } catch (e) {
                console.error(`Failed to save auto-updated goal ${goal.id}:`, e);
              }
            }
          }
          
          setGoals(updatedGoals);
        } else {
          setGoals(frontendGoals);
        }
      } catch (error: any) {
        console.error("Failed to load goals from API:", error);
        // Fallback to localStorage if API endpoint doesn't exist yet (migration not applied)
        // Check for 404, network errors, or any error that suggests the endpoint doesn't exist
        const isEndpointMissing = 
          error.response?.status === 404 || 
          error.code === "ERR_NETWORK" ||
          error.message?.includes("404") ||
          !error.response; // No response means endpoint might not exist
        
        if (isEndpointMissing) {
          try {
            const stored = localStorage.getItem("waterways_goals");
            if (stored) {
              const localGoals: Goal[] = JSON.parse(stored);
              const filtered = seasonId
                ? localGoals.filter(g => !g.seasonId || g.seasonId === seasonId)
                : localGoals;
              setGoals(filtered);
              console.log("Loaded goals from localStorage (fallback - API endpoint not available)");
            } else {
              setGoals([]);
            }
          } catch (localError) {
            console.error("Failed to load goals from localStorage:", localError);
            setGoals([]);
          }
        } else {
          // Other errors - just set empty array to prevent breaking
          setGoals([]);
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadGoals();
  }, [seasonId, competitionTrends]);

  const saveGoal = async (goalData: Omit<Goal, "id" | "createdAt" | "updatedAt" | "progress" | "status" | "history" | "achievedAt">) => {
    try {
      if (editingGoal) {
        // Update existing goal
        try {
          const response = await api.put(`/goals/${editingGoal.id}`, goalToDbGoal(goalData));
          const updatedGoal = dbGoalToGoal(response.data);
          setGoals(goals.map(g => g.id === updatedGoal.id ? updatedGoal : g));
        } catch (apiError: any) {
          // Fallback to localStorage if API not available
          if (apiError.response?.status === 404) {
            throw new Error("API endpoint not available. Please apply database migration.");
          }
          throw apiError;
        }
      } else {
        // Create new goal
        try {
          const response = await api.post("/goals", goalToDbGoal(goalData));
          const newGoal = dbGoalToGoal(response.data);
          setGoals([...goals, newGoal]);
        } catch (apiError: any) {
          // Fallback to localStorage if API not available
          if (apiError.response?.status === 404) {
            throw new Error("API endpoint not available. Please apply database migration.");
          }
          throw apiError;
        }
      }
      
      setShowForm(false);
      setEditingGoal(undefined);
      onGoalUpdate?.();
    } catch (error: any) {
      console.error("Failed to save goal:", error);
      alert(error.message || "Failed to save goal. Please try again.");
    }
  };

  const deleteGoal = async (goalId: string) => {
    if (!confirm("Are you sure you want to delete this goal?")) return;
    
    try {
      try {
        await api.delete(`/goals/${goalId}`);
      } catch (apiError: any) {
        // Fallback to localStorage if API not available
        if (apiError.response?.status === 404) {
          // Try localStorage fallback
          const stored = localStorage.getItem("waterways_goals");
          if (stored) {
            const localGoals: Goal[] = JSON.parse(stored);
            localStorage.setItem("waterways_goals", JSON.stringify(localGoals.filter(g => g.id !== goalId)));
          }
        } else {
          throw apiError;
        }
      }
      setGoals(goals.filter(g => g.id !== goalId));
      onGoalUpdate?.();
    } catch (error: any) {
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
