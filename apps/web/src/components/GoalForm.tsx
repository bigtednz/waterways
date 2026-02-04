import { useState, useEffect } from "react";
import { Goal, GoalType, calculateProgress, calculateStatus, getSuggestedAutoUpdateSource } from "../lib/goals";

interface GoalFormProps {
  goal?: Goal;
  onSave: (goal: Omit<Goal, "id" | "createdAt" | "updatedAt" | "progress" | "status" | "history" | "achievedAt">) => void;
  onCancel: () => void;
  seasons?: Array<{ id: string; name: string; year: number }>;
}

export function GoalForm({ goal, onSave, onCancel, seasons = [] }: GoalFormProps) {
  const [title, setTitle] = useState(goal?.title || "");
  const [description, setDescription] = useState(goal?.description || "");
  const [type, setType] = useState<GoalType>(goal?.type || "time");
  const [target, setTarget] = useState(goal?.target.toString() || "");
  const [current, setCurrent] = useState(goal?.current.toString() || "0");
  const [deadline, setDeadline] = useState(goal?.deadline ? goal.deadline.split("T")[0] : "");
  const [seasonId, setSeasonId] = useState(goal?.seasonId || "");
  const [autoUpdate, setAutoUpdate] = useState(goal?.autoUpdate || false);

  const getUnit = (goalType: GoalType): string => {
    switch (goalType) {
      case "time":
        return "seconds";
      case "penalty":
        return "seconds";
      case "consistency":
        return "seconds (IQR)";
      case "completion":
        return "percentage";
      default:
        return "";
    }
  };

  const getPlaceholder = (goalType: GoalType): string => {
    switch (goalType) {
      case "time":
        return "e.g., 120 (for 120 seconds)";
      case "penalty":
        return "e.g., 10 (for 10 seconds total penalties)";
      case "consistency":
        return "e.g., 5 (for IQR of 5 seconds)";
      case "completion":
        return "e.g., 90 (for 90% completion rate)";
      default:
        return "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const targetNum = parseFloat(target);
    const currentNum = parseFloat(current);
    
    if (isNaN(targetNum) || targetNum <= 0) {
      alert("Please enter a valid target value");
      return;
    }
    
    if (isNaN(currentNum) || currentNum < 0) {
      alert("Please enter a valid current value");
      return;
    }

    const progress = calculateProgress(currentNum, targetNum, type);
    const status = calculateStatus(progress, deadline || undefined, type);
    const suggestedSource = getSuggestedAutoUpdateSource(type);

    onSave({
      title,
      description: description || undefined,
      type,
      target: targetNum,
      current: currentNum,
      unit: getUnit(type),
      deadline: deadline || undefined,
      seasonId: seasonId || undefined,
      autoUpdate: autoUpdate,
      autoUpdateSource: autoUpdate ? (goal?.autoUpdateSource || suggestedSource) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Goal Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Reduce median clean time to 120s"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Optional description of your goal"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Goal Type *
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as GoalType)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="time">Time Target (lower is better)</option>
          <option value="penalty">Penalty Reduction (lower is better)</option>
          <option value="consistency">Consistency/IQR (lower is better)</option>
          <option value="completion">Completion Rate (higher is better)</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Current Value *
          </label>
          <input
            type="number"
            step="0.1"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Value *
          </label>
          <input
            type="number"
            step="0.1"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={getPlaceholder(type)}
          />
        </div>
      </div>

      {seasons.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Season (Optional)
          </label>
          <select
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Seasons</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name} ({season.year})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Deadline (Optional)
        </label>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="autoUpdate"
            checked={autoUpdate}
            onChange={(e) => setAutoUpdate(e.target.checked)}
            className="mt-1"
          />
          <div className="flex-1">
            <label htmlFor="autoUpdate" className="block text-sm font-medium text-gray-900 cursor-pointer">
              Auto-update from performance data
            </label>
            <p className="text-xs text-gray-600 mt-1">
              Automatically update current value from your latest competition performance. 
              {getSuggestedAutoUpdateSource(type) && (
                <span className="block mt-1">
                  Will use: <strong>{getSuggestedAutoUpdateSource(type)}</strong>
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          {goal ? "Update Goal" : "Create Goal"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
