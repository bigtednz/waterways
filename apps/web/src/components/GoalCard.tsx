import { Goal, getStatusColor, getStatusText, formatGoalValue, getGoalTypeIcon, getGoalTypeName } from "../lib/goals";
import { formatTime } from "../lib/utils";

interface GoalCardProps {
  goal: Goal;
  onEdit?: (goal: Goal) => void;
  onDelete?: (goalId: string) => void;
  compact?: boolean;
}

export function GoalCard({ goal, onEdit, onDelete, compact = false }: GoalCardProps) {
  const statusColor = getStatusColor(goal.status);
  const statusText = getStatusText(goal.status);
  const typeIcon = getGoalTypeIcon(goal.type);
  const typeName = getGoalTypeName(goal.type);
  
  const remaining = goal.type === "time" || goal.type === "penalty" || goal.type === "consistency"
    ? Math.max(0, goal.current - goal.target)
    : Math.max(0, goal.target - goal.current);
  
  const isImproving = goal.type === "time" || goal.type === "penalty" || goal.type === "consistency"
    ? goal.current <= goal.target
    : goal.current >= goal.target;

  if (compact) {
    return (
      <div className="bg-white rounded-lg border-2 border-gray-200 p-3 hover:border-blue-300 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{typeIcon}</span>
            <span className="font-semibold text-gray-900 text-sm">{goal.title}</span>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColor} text-white`}>
            {statusText}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
          <span>Progress: {goal.progress.toFixed(0)}%</span>
          <span>
            {formatGoalValue(goal.current, goal.type, goal.unit)} / {formatGoalValue(goal.target, goal.type, goal.unit)}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${statusColor}`}
            style={{ width: `${Math.min(100, goal.progress)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg border-2 border-gray-200 p-5 hover:border-blue-300 transition-all shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{typeIcon}</span>
            <div>
              <h3 className="font-semibold text-gray-900">{goal.title}</h3>
              <p className="text-xs text-gray-500">{typeName}</p>
            </div>
          </div>
          {goal.description && (
            <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor} text-white`}>
            {statusText}
          </span>
          {onEdit && (
            <button
              onClick={() => onEdit(goal)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(goal.id)}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-bold text-gray-900">{goal.progress.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${statusColor}`}
              style={{ width: `${Math.min(100, goal.progress)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="text-xs text-blue-700 font-medium mb-1">Current</p>
            <p className="text-lg font-bold text-blue-900">
              {formatGoalValue(goal.current, goal.type, goal.unit)}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
            <p className="text-xs text-green-700 font-medium mb-1">Target</p>
            <p className="text-lg font-bold text-green-900">
              {formatGoalValue(goal.target, goal.type, goal.unit)}
            </p>
          </div>
        </div>

        {isImproving ? (
          <div className="bg-green-50 rounded-lg p-2 border border-green-200">
            <p className="text-xs text-green-700 font-medium">
              ✅ Goal achieved! {goal.type === "completion" ? "Exceeded" : "Better than"} target
            </p>
          </div>
        ) : (
          <div className="bg-yellow-50 rounded-lg p-2 border border-yellow-200">
            <p className="text-xs text-yellow-700 font-medium">
              {goal.type === "time" || goal.type === "penalty" || goal.type === "consistency"
                ? `Need to improve by ${formatTime(remaining)} to reach target`
                : `Need ${remaining.toFixed(0)}% more to reach target`}
            </p>
          </div>
        )}

        {goal.deadline && (
          <div className="text-xs text-gray-500">
            Deadline: {new Date(goal.deadline).toLocaleDateString()}
          </div>
        )}
        
        {goal.autoUpdate && (
          <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
            <span>🔄</span>
            <span>Auto-updating from {goal.autoUpdateSource}</span>
          </div>
        )}
        
        {goal.achievedAt && (
          <div className="mt-2 text-xs text-green-600 font-medium">
            🏆 Achieved on {new Date(goal.achievedAt).toLocaleDateString()}
          </div>
        )}
      </div>
      
      {/* Goal History Timeline */}
      {goal.history && goal.history.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <details className="cursor-pointer">
            <summary className="text-xs font-semibold text-gray-700 mb-2">
              📈 History ({goal.history.length} entries)
            </summary>
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
              {goal.history.slice(-10).reverse().map((entry, idx) => (
                <div key={idx} className="text-xs text-gray-600 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  <span>{new Date(entry.date).toLocaleDateString()}</span>
                  <span className="text-gray-400">•</span>
                  <span>Progress: {entry.progress.toFixed(0)}%</span>
                  {entry.note && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-500 italic">{entry.note}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
