import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { formatDate, formatTime } from "../lib/utils";
import type { CompetitionTrend } from "@waterways/shared";
import { PenaltyInterpreter } from "../components/PenaltyInterpreter";

interface RunResult {
  id: string;
  runType: { code: string; name: string };
  totalTimeSeconds: number;
  penaltySeconds: number;
  notes?: string;
}

interface Competition {
  id: string;
  name: string;
  date: string;
  location?: string;
  season: { id: string; name: string };
  runResults: RunResult[];
}

export function CompetitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [runTypes, setRunTypes] = useState<any[]>([]);
  const [quickEntry, setQuickEntry] = useState<Record<string, any>>({});
  const [competitionTrends, setCompetitionTrends] = useState<CompetitionTrend[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(true);

  // Redirect if "new" is passed as id (shouldn't happen with correct routing, but safety check)
  useEffect(() => {
    if (id === "new") {
      navigate("/app/competitions/new", { replace: true });
      return;
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!id || id === "new") return;

    Promise.all([
      api.get(`/competitions/${id}`).then((res) => setCompetition(res.data)),
      api.get("/run-types").then((res) => setRunTypes(res.data)),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // Load competition trends for comparison
  useEffect(() => {
    if (!competition?.season?.id) return;

    setLoadingTrends(true);
    api
      .get(`/analytics/competition-trends?seasonId=${competition.season.id}`)
      .then((res) => setCompetitionTrends(res.data))
      .catch((err) => {
        console.error("Failed to load competition trends:", err);
        setCompetitionTrends([]);
      })
      .finally(() => setLoadingTrends(false));
  }, [competition?.season?.id]);

  useEffect(() => {
    if (runTypes.length > 0 && competition) {
      const entry: Record<string, any> = {};
      runTypes.forEach((rt) => {
        const existing = competition.runResults.find(
          (rr) => rr.runType.code === rt.code
        );
        entry[rt.code] = {
          totalTimeSeconds: existing?.totalTimeSeconds || "",
          penaltySeconds: existing?.penaltySeconds || 0,
          notes: existing?.notes || "",
        };
      });
      // Set default selected run type for interpreter
      if (runTypes.length > 0 && !entry.selectedRunTypeForInterpreter) {
        entry.selectedRunTypeForInterpreter = runTypes[0].code;
      }
      setQuickEntry(entry);
    }
  }, [runTypes, competition]);

  const handleQuickEntryChange = (runTypeCode: string, field: string, value: any) => {
    setQuickEntry((prev) => ({
      ...prev,
      [runTypeCode]: {
        ...prev[runTypeCode],
        [field]: value,
      },
    }));
  };

  const handleBulkSave = async () => {
    if (!id || !competition) return;

    const runs = Object.entries(quickEntry)
      .filter(([_, data]) => data.totalTimeSeconds)
      .map(([code, data]) => ({
        runTypeCode: code,
        totalTimeSeconds: parseFloat(data.totalTimeSeconds),
        penaltySeconds: parseFloat(data.penaltySeconds) || 0,
        notes: data.notes || undefined,
      }));

    try {
      // Check which runs already exist and need updating vs creating
      const existingRunMap = new Map(
        competition.runResults.map((rr) => [rr.runType.code, rr])
      );

      const toCreate: typeof runs = [];
      const toUpdate: Array<{ id: string; data: typeof runs[0] }> = [];

      runs.forEach((run) => {
        const existing = existingRunMap.get(run.runTypeCode);
        if (existing) {
          toUpdate.push({ id: existing.id, data: run });
        } else {
          toCreate.push(run);
        }
      });

      // Update existing runs
      await Promise.all(
        toUpdate.map(({ id, data }) =>
          api.put(`/run-results/${id}`, {
            totalTimeSeconds: data.totalTimeSeconds,
            penaltySeconds: data.penaltySeconds,
            notes: data.notes,
          })
        )
      );

      // Create new runs
      if (toCreate.length > 0) {
        await api.post("/run-results/bulk", {
          competitionId: id,
          runs: toCreate,
        });
      }

      window.location.reload();
    } catch (error) {
      console.error("Failed to save runs:", error);
      alert("Failed to save runs. Please try again.");
    }
  };

  const handleDeleteRun = async (runResultId: string) => {
    if (!confirm("Are you sure you want to delete this run?")) return;

    try {
      await api.delete(`/run-results/${runResultId}`);
      window.location.reload();
    } catch (error) {
      console.error("Failed to delete run:", error);
      alert("Failed to delete run. Please try again.");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!competition) {
    return <div className="text-center py-8">Competition not found</div>;
  }

  const cleanTimeMedian = (() => {
    const cleanTimes = competition.runResults.map(
      (rr) => Math.max(0, rr.totalTimeSeconds - rr.penaltySeconds)
    );
    if (cleanTimes.length === 0) return 0;
    const sorted = [...cleanTimes].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  })();

  const totalPenalties = competition.runResults.reduce(
    (sum, rr) => sum + rr.penaltySeconds,
    0
  );

  // Calculate comparison metrics
  const currentTrend = competitionTrends.find((t) => t.competitionId === competition.id);
  const sortedTrends = [...competitionTrends].sort(
    (a, b) => new Date(a.competitionDate).getTime() - new Date(b.competitionDate).getTime()
  );
  
  const bestPerformance = sortedTrends.length > 0
    ? Math.min(...sortedTrends.map((t) => t.medianCleanTime))
    : null;
  
  const seasonAverage = sortedTrends.length > 0
    ? sortedTrends.reduce((sum, t) => sum + t.medianCleanTime, 0) / sortedTrends.length
    : null;
  
  const currentIndex = sortedTrends.findIndex((t) => t.competitionId === competition.id);
  const previousCompetition = currentIndex > 0 ? sortedTrends[currentIndex - 1] : null;
  
  const comparisonToBest = currentTrend && bestPerformance && bestPerformance > 0
    ? ((currentTrend.medianCleanTime - bestPerformance) / bestPerformance) * 100
    : null;
  
  const comparisonToAverage = currentTrend && seasonAverage && seasonAverage > 0
    ? ((currentTrend.medianCleanTime - seasonAverage) / seasonAverage) * 100
    : null;
  
  const comparisonToPrevious = currentTrend && previousCompetition && previousCompetition.medianCleanTime > 0
    ? currentTrend.medianCleanTime - previousCompetition.medianCleanTime
    : null;

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => navigate("/competitions")}
          className="text-blue-600 hover:underline mb-4"
        >
          ← Back to Competitions
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{competition.name}</h1>
        <p className="text-gray-600 mt-1">
          {formatDate(competition.date)} {competition.location && `• ${competition.location}`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Runs Completed</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {competition.runResults.length} / 9
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Median Clean Time</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {formatTime(cleanTimeMedian)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Penalties</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {formatTime(totalPenalties)}
          </p>
        </div>
      </div>

      {/* Comparison to Standard */}
      {!loadingTrends && currentTrend && sortedTrends.length > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-blue-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Comparison to Season Standard
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Best Performance */}
            {bestPerformance !== null && (
              <div className="bg-white p-4 rounded-lg border border-emerald-200">
                <p className="text-xs text-gray-500 mb-1">Best Performance (Season)</p>
                <p className="text-2xl font-bold text-emerald-900">
                  {formatTime(bestPerformance)}
                </p>
                {comparisonToBest !== null && (
                  <p className={`text-xs mt-2 font-semibold ${
                    comparisonToBest <= 0
                      ? "text-emerald-600"
                      : comparisonToBest <= 5
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}>
                    {comparisonToBest <= 0
                      ? "✓ At or better than best"
                      : comparisonToBest <= 5
                      ? `+${comparisonToBest.toFixed(1)}% slower`
                      : `+${comparisonToBest.toFixed(1)}% slower`}
                  </p>
                )}
              </div>
            )}

            {/* Season Average */}
            {seasonAverage !== null && (
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <p className="text-xs text-gray-500 mb-1">Season Average</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatTime(seasonAverage)}
                </p>
                {comparisonToAverage !== null && (
                  <p className={`text-xs mt-2 font-semibold ${
                    comparisonToAverage <= 0
                      ? "text-emerald-600"
                      : comparisonToAverage <= 5
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}>
                    {comparisonToAverage <= 0
                      ? `✓ ${Math.abs(comparisonToAverage).toFixed(1)}% faster than average`
                      : `${comparisonToAverage.toFixed(1)}% slower than average`}
                  </p>
                )}
              </div>
            )}

            {/* Previous Competition */}
            {previousCompetition && (
              <div className="bg-white p-4 rounded-lg border border-purple-200">
                <p className="text-xs text-gray-500 mb-1">Previous Competition</p>
                <p className="text-2xl font-bold text-purple-900">
                  {formatTime(previousCompetition.medianCleanTime)}
                </p>
                {comparisonToPrevious !== null && (
                  <p className={`text-xs mt-2 font-semibold ${
                    comparisonToPrevious < 0
                      ? "text-emerald-600"
                      : comparisonToPrevious === 0
                      ? "text-gray-600"
                      : "text-red-600"
                  }`}>
                    {comparisonToPrevious < 0
                      ? `✓ ${formatTime(Math.abs(comparisonToPrevious))} faster`
                      : comparisonToPrevious === 0
                      ? "Same performance"
                      : `${formatTime(comparisonToPrevious)} slower`}
                  </p>
                )}
              </div>
            )}

            {/* Performance Rank */}
            {sortedTrends.length > 0 && (
              <div className="bg-white p-4 rounded-lg border border-amber-200">
                <p className="text-xs text-gray-500 mb-1">Season Rank</p>
                <p className="text-2xl font-bold text-amber-900">
                  #{sortedTrends
                    .map((t) => t.medianCleanTime)
                    .sort((a, b) => a - b)
                    .indexOf(currentTrend.medianCleanTime) + 1}
                  <span className="text-sm text-gray-500"> / {sortedTrends.length}</span>
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {sortedTrends
                    .map((t) => t.medianCleanTime)
                    .sort((a, b) => a - b)
                    .indexOf(currentTrend.medianCleanTime) === 0
                    ? "Best performance"
                    : sortedTrends
                        .map((t) => t.medianCleanTime)
                        .sort((a, b) => a - b)
                        .indexOf(currentTrend.medianCleanTime) === sortedTrends.length - 1
                    ? "Needs improvement"
                    : "Above average"}
                </p>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="flex items-start gap-2">
              <span className="text-lg">
                {comparisonToBest !== null && comparisonToBest <= 0
                  ? "🏆"
                  : comparisonToAverage !== null && comparisonToAverage <= 0
                  ? "✓"
                  : "📊"}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {comparisonToBest !== null && comparisonToBest <= 0
                    ? "Excellent Performance"
                    : comparisonToAverage !== null && comparisonToAverage <= 0
                    ? "Above Average Performance"
                    : "Below Average Performance"}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {comparisonToBest !== null && comparisonToBest <= 0
                    ? "This competition matches or exceeds your best performance this season."
                    : comparisonToAverage !== null && comparisonToAverage <= 0
                    ? `You performed ${Math.abs(comparisonToAverage).toFixed(1)}% better than the season average.`
                    : comparisonToAverage !== null
                    ? `You performed ${comparisonToAverage.toFixed(1)}% slower than the season average.`
                    : "Compare your performance to season benchmarks above."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Quick Entry</h2>
          <p className="text-sm text-gray-500 mt-1">
            Enter all 9 run results for this competition
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Run Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total Time (s)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Penalty (s)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {runTypes.map((rt) => (
                <tr key={rt.code}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    {rt.code} - {rt.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      step="0.1"
                      value={quickEntry[rt.code]?.totalTimeSeconds || ""}
                      onChange={(e) =>
                        handleQuickEntryChange(rt.code, "totalTimeSeconds", e.target.value)
                      }
                      className="w-24 px-2 py-1 border border-gray-300 rounded"
                      placeholder="0.0"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      step="0.1"
                      value={quickEntry[rt.code]?.penaltySeconds || 0}
                      onChange={(e) =>
                        handleQuickEntryChange(rt.code, "penaltySeconds", e.target.value)
                      }
                      className="w-24 px-2 py-1 border border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      value={quickEntry[rt.code]?.notes || ""}
                      onChange={(e) =>
                        handleQuickEntryChange(rt.code, "notes", e.target.value)
                      }
                      className="w-full px-2 py-1 border border-gray-300 rounded"
                      placeholder="Optional notes"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-6 border-t flex justify-between items-center">
          <p className="text-sm text-gray-500">
            {competition.runResults.length > 0
              ? "Update existing runs or add new ones. Changes will be saved when you click 'Save All Runs'."
              : "Enter run data and click 'Save All Runs' to create run results."}
          </p>
          <button
            onClick={handleBulkSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            Save All Runs
          </button>
        </div>
      </div>

      {/* Penalty Interpreter - Available when adding runs */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Penalty Notes Interpreter</h2>
          <p className="text-sm text-gray-500 mt-1">
            Enter penalty notes to get structured diagnostics and coaching recommendations
          </p>
        </div>
        <div className="p-6">
          {runTypes.length > 0 ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="interpreter-run-type" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Run Type
                </label>
                <select
                  id="interpreter-run-type"
                  value={quickEntry.selectedRunTypeForInterpreter || runTypes[0]?.code || ""}
                  onChange={(e) => {
                    const selectedCode = e.target.value;
                    setQuickEntry((prev) => ({
                      ...prev,
                      selectedRunTypeForInterpreter: selectedCode,
                    }));
                  }}
                  className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {runTypes.map((rt) => (
                    <option key={rt.code} value={rt.code}>
                      {rt.code} - {rt.name}
                    </option>
                  ))}
                </select>
              </div>
              {quickEntry.selectedRunTypeForInterpreter && (
                <PenaltyInterpreter
                  key={`${quickEntry.selectedRunTypeForInterpreter}-${quickEntry[quickEntry.selectedRunTypeForInterpreter]?.notes || ""}`}
                  runTypeCode={quickEntry.selectedRunTypeForInterpreter || runTypes[0]?.code || ""}
                  initialNotes={quickEntry[quickEntry.selectedRunTypeForInterpreter || runTypes[0]?.code]?.notes || ""}
                  competitionId={id}
                  seasonId={competition?.season?.id}
                />
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Loading run types...</p>
          )}
        </div>
      </div>

      {competition.runResults.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Current Results</h2>
            <p className="text-sm text-gray-500 mt-1">
              Edit runs above or delete individual runs below
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Run Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Penalty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Clean Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {competition.runResults.map((rr) => {
                  const cleanTime = Math.max(0, rr.totalTimeSeconds - rr.penaltySeconds);
                  return (
                    <tr key={rr.id}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        {rr.runType.code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatTime(rr.totalTimeSeconds)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-red-600">
                        {rr.penaltySeconds > 0 ? `+${formatTime(rr.penaltySeconds)}` : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold">
                        {formatTime(cleanTime)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{rr.notes || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteRun(rr.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
