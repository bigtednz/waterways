import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";
import api from "../lib/api";
import { formatDate, formatTime } from "../lib/utils";
import type {
  CompetitionTrend,
  RunDiagnostic,
  DriverAnalysis,
  CoachingSummary,
} from "@waterways/shared";

type AnalysisMode = "competition" | "run";

interface Season {
  id: string;
  name: string;
  year: number;
}

export function AnalysisPage() {
  const [mode, setMode] = useState<AnalysisMode>("competition");
  const [selectedRunType, setSelectedRunType] = useState<string>("");
  const [runTypes, setRunTypes] = useState<any[]>([]);
  const [competitionTrends, setCompetitionTrends] = useState<CompetitionTrend[]>([]);
  const [runDiagnostic, setRunDiagnostic] = useState<RunDiagnostic | null>(null);
  const [drivers, setDrivers] = useState<DriverAnalysis[]>([]);
  const [coachingSummary, setCoachingSummary] = useState<CoachingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get("/run-types").then((res) => {
        setRunTypes(res.data);
        if (res.data.length > 0) {
          setSelectedRunType(res.data[0].code);
        }
      }),
      api.get("/seasons").then((res) => {
        const seasonsData = res.data as Season[];
        setSeasons(seasonsData);
        // Set default to latest season
        if (seasonsData.length > 0 && !selectedSeasonId) {
          const latestSeason = [...seasonsData].sort((a, b) => b.year - a.year)[0];
          setSelectedSeasonId(latestSeason.id);
        }
      }),
    ]).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const seasonParam = selectedSeasonId ? `?seasonId=${selectedSeasonId}` : "";
    Promise.all([
      api.get(`/analytics/competition-trends${seasonParam}`).then((res) => setCompetitionTrends(res.data)),
      api.get(`/analytics/drivers${seasonParam}`).then((res) => setDrivers(res.data)),
      api.get(`/analytics/coaching-summary${seasonParam}`).then((res) => setCoachingSummary(res.data)),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedSeasonId]);

  useEffect(() => {
    if (mode === "run" && selectedRunType) {
      api
        .get(`/analytics/run-diagnostics?runTypeCode=${selectedRunType}`)
        .then((res) => setRunDiagnostic(res.data))
        .catch(console.error);
    }
  }, [mode, selectedRunType]);

  // Calculate benchmark metrics
  const sortedTrends = [...competitionTrends].sort(
    (a, b) => new Date(a.competitionDate).getTime() - new Date(b.competitionDate).getTime()
  );
  
  const bestPerformance = sortedTrends.length > 0
    ? Math.min(...sortedTrends.map((t) => t.medianCleanTime))
    : null;
  
  const worstPerformance = sortedTrends.length > 0
    ? Math.max(...sortedTrends.map((t) => t.medianCleanTime))
    : null;
  
  const seasonAverage = sortedTrends.length > 0
    ? sortedTrends.reduce((sum, t) => sum + t.medianCleanTime, 0) / sortedTrends.length
    : null;
  
  const latestCompetition = sortedTrends.length > 0 ? sortedTrends[sortedTrends.length - 1] : null;
  const latestPerformance = latestCompetition?.medianCleanTime || null;
  
  const performanceScore = bestPerformance && worstPerformance && latestPerformance && worstPerformance !== bestPerformance
    ? Math.max(0, Math.min(100, ((worstPerformance - latestPerformance) / (worstPerformance - bestPerformance)) * 100))
    : null;
  
  const comparisonToAverage = latestPerformance && seasonAverage && seasonAverage > 0
    ? ((latestPerformance - seasonAverage) / seasonAverage) * 100
    : null;

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Analysis</h1>
          <p className="text-gray-600 mt-1">Competition trends and run diagnostics</p>
        </div>
        {seasons.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Season Scope
            </label>
            <select
              value={selectedSeasonId || ""}
              onChange={(e) => setSelectedSeasonId(e.target.value || null)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Seasons</option>
              {[...seasons]
                .sort((a, b) => b.year - a.year)
                .map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name} ({season.year})
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Benchmark Metrics */}
      {sortedTrends.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Season Benchmarks</h2>
              <p className="text-sm text-gray-600 mt-1">Key performance metrics for the selected season</p>
            </div>
            <button
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              title="How to read these metrics"
              onClick={(e) => {
                e.preventDefault();
                alert(`HOW TO READ:\n\n• Best Performance: Your fastest median clean time this season (goal to beat)\n• Season Average: Your average median clean time across all competitions\n• Worst Performance: Your slowest median clean time (avoid repeating)\n• Current Score: How your latest performance ranks (0-100)\n  - 80-100 = Excellent (near or at best)\n  - 60-79 = Good (above average)\n  - 0-59 = Needs improvement (below average)\n\nUse these to:\n- Set goals based on your best\n- Track progress toward season average\n- See how latest performance compares\n- Identify improvement opportunities`);
              }}
            >
              ℹ️ How to Read
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {bestPerformance !== null && (
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-lg shadow-lg border-2 border-emerald-300">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🏆</span>
                  <h3 className="text-sm font-semibold text-emerald-800">Best Performance</h3>
                </div>
                <p className="text-3xl font-bold text-emerald-900 mt-2">
                  {formatTime(bestPerformance)}
                </p>
                <p className="text-xs text-emerald-700 mt-2 font-medium">Season minimum (fastest)</p>
                <p className="text-xs text-emerald-600 mt-1">Your goal to beat</p>
              </div>
            )}
            
            {seasonAverage !== null && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg shadow-lg border-2 border-blue-300">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📊</span>
                  <h3 className="text-sm font-semibold text-blue-800">Season Average</h3>
                </div>
                <p className="text-3xl font-bold text-blue-900 mt-2">
                  {formatTime(seasonAverage)}
                </p>
                <p className="text-xs text-blue-700 mt-2 font-medium">Mean median clean time</p>
                <p className="text-xs text-blue-600 mt-1">Your typical performance</p>
              </div>
            )}
            
            {worstPerformance !== null && (
              <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-lg shadow-lg border-2 border-red-300">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⚠️</span>
                  <h3 className="text-sm font-semibold text-red-800">Worst Performance</h3>
                </div>
                <p className="text-3xl font-bold text-red-900 mt-2">
                  {formatTime(worstPerformance)}
                </p>
                <p className="text-xs text-red-700 mt-2 font-medium">Season maximum (slowest)</p>
                <p className="text-xs text-red-600 mt-1">Avoid repeating</p>
              </div>
            )}
            
            {performanceScore !== null && (
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-lg shadow-lg border-2 border-indigo-300">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⭐</span>
                  <h3 className="text-sm font-semibold text-indigo-800">Performance Score</h3>
                </div>
                <div className="mt-2">
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold text-indigo-900">
                      {Math.round(performanceScore)}
                    </span>
                    <span className="text-lg text-indigo-600 ml-2">/100</span>
                  </div>
                  <div className="mt-3 w-full bg-indigo-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        performanceScore >= 80
                          ? "bg-green-500"
                          : performanceScore >= 60
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${performanceScore}%` }}
                    />
                  </div>
                  <p className="text-xs text-indigo-700 mt-2 font-medium">
                    {performanceScore >= 80
                      ? "Excellent - Near your best!"
                      : performanceScore >= 60
                      ? "Good - Above average"
                      : "Needs improvement"}
                  </p>
                  <p className="text-xs text-indigo-600 mt-1">Latest vs season range</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setMode("competition")}
            className={`px-4 py-2 rounded-md ${
              mode === "competition"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Competition Performance
          </button>
          <button
            onClick={() => setMode("run")}
            className={`px-4 py-2 rounded-md ${
              mode === "run"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Run Diagnostics
          </button>
        </div>

        {mode === "competition" && (
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Competition Trends</h2>
                  <p className="text-sm text-gray-600 mt-1">Performance over time across competitions</p>
                </div>
                <button
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  title="How to read this chart"
                  onClick={(e) => {
                    e.preventDefault();
                    alert(`HOW TO READ:\n\n• X-axis: Competition names (chronological order)\n• Y-axis: Median clean time (time without penalties)\n• Blue line: Your median clean time for each competition\n• Gray dashed line: Season average (reference point)\n• Green dashed line: Your best performance (goal to beat)\n\nInterpretation:\n• Line going down = Improving (getting faster)\n• Line going up = Declining (getting slower)\n• Below gray line = Better than average\n• Below green line = Better than your best!\n• Above gray line = Below average (needs improvement)\n\nUse this to:\n- Track long-term performance trends\n- See if you're improving or declining\n- Compare each competition to your average and best`);
                  }}
                >
                  ℹ️ How to Read
                </button>
              </div>
              <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={competitionTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="competitionName"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fontSize: 11 }}
                      label={{ value: "Competition", position: "insideBottom", offset: -5 }}
                    />
                    <YAxis 
                      tickFormatter={(value) => formatTime(value)}
                      label={{ value: "Median Clean Time (seconds)", angle: -90, position: "insideLeft" }}
                    />
                    <Tooltip
                      formatter={(value: number) => formatTime(value)}
                      labelFormatter={(label) => `Competition: ${label}`}
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
                    />
                    <Legend />
                    {seasonAverage !== null && (
                      <ReferenceLine
                        y={seasonAverage}
                        stroke="#6b7280"
                        strokeDasharray="5 5"
                        label={{ value: "Season Average", position: "right" }}
                      />
                    )}
                    {bestPerformance !== null && (
                      <ReferenceLine
                        y={bestPerformance}
                        stroke="#10b981"
                        strokeDasharray="3 3"
                        label={{ value: "Your Best", position: "right" }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="medianCleanTime"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ fill: "#3b82f6", r: 5 }}
                      name="Median Clean Time"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Penalty Load</h3>
                    <p className="text-xs text-gray-600 mt-1">Total penalty time per competition</p>
                  </div>
                  <button
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    title="How to read this chart"
                    onClick={(e) => {
                      e.preventDefault();
                      alert(`HOW TO READ:\n\n• X-axis: Competition names\n• Y-axis: Total penalty time (seconds)\n• Red area: Sum of all penalties in that competition\n• Larger area = more penalties\n\nInterpretation:\n• Increasing trend = Getting more penalties over time (bad)\n• Decreasing trend = Reducing penalties (good)\n• Spikes = Specific competitions with high penalties\n\nUse this to:\n- Identify competitions with penalty problems\n- Track if penalty management is improving\n- See which competitions need penalty review`);
                    }}
                  >
                    ℹ️ How to Read
                  </button>
                </div>
                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={competitionTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="competitionName" 
                        angle={-45} 
                        textAnchor="end" 
                        height={80}
                        tick={{ fontSize: 10 }}
                        label={{ value: "Competition", position: "insideBottom", offset: -5 }}
                      />
                      <YAxis 
                        tickFormatter={(value) => formatTime(value)}
                        label={{ value: "Penalty Time (seconds)", angle: -90, position: "insideLeft" }}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatTime(value)}
                        labelFormatter={(label) => `Competition: ${label}`}
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
                      />
                      <Legend />
                      {(() => {
                        const penaltyLoads = competitionTrends.map(t => t.penaltyLoad);
                        const avgPenaltyLoad = penaltyLoads.length > 0
                          ? penaltyLoads.reduce((sum, p) => sum + p, 0) / penaltyLoads.length
                          : null;
                        return avgPenaltyLoad !== null ? (
                          <ReferenceLine
                            y={avgPenaltyLoad}
                            stroke="#6b7280"
                            strokeDasharray="5 5"
                            label={{ value: "Avg Penalty", position: "right" }}
                          />
                        ) : null;
                      })()}
                      <Area
                        type="monotone"
                        dataKey="penaltyLoad"
                        stroke="#ef4444"
                        fill="#ef4444"
                        fillOpacity={0.6}
                        name="Total Penalty Time"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {(() => {
                  const penaltyLoads = competitionTrends.map(t => t.penaltyLoad);
                  const avgPenaltyLoad = penaltyLoads.length > 0
                    ? penaltyLoads.reduce((sum, p) => sum + p, 0) / penaltyLoads.length
                    : null;
                  
                  // Calculate trend
                  let penaltyTrend: { change: number; changePercent: number; isImproving: boolean; message: string } | null = null;
                  if (penaltyLoads.length >= 3) {
                    const recent = penaltyLoads.slice(-3);
                    const earlier = penaltyLoads.slice(0, -3);
                    if (earlier.length > 0) {
                      const recentAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
                      const earlierAvg = earlier.reduce((sum, p) => sum + p, 0) / earlier.length;
                      const change = recentAvg - earlierAvg;
                      const changePercent = earlierAvg > 0 ? (change / earlierAvg) * 100 : 0;
                      penaltyTrend = {
                        change,
                        changePercent,
                        isImproving: change < 0,
                        message: change < 0
                          ? `Penalties decreasing by ${formatTime(Math.abs(change))} (${Math.abs(changePercent).toFixed(1)}%)`
                          : change > 0
                          ? `Penalties increasing by ${formatTime(change)} (${changePercent.toFixed(1)}%)`
                          : "Penalty load stable"
                      };
                    }
                  }
                  
                  // Calculate impact
                  const avgCleanTime = competitionTrends.reduce((sum, t) => sum + t.medianCleanTime, 0) / competitionTrends.length;
                  const penaltyImpact = avgPenaltyLoad && avgCleanTime > 0
                    ? (avgPenaltyLoad / (avgCleanTime + avgPenaltyLoad)) * 100
                    : null;
                  
                  return (
                    <div className="mt-2 space-y-2">
                      {penaltyTrend && (
                        <div className={`p-2 rounded border ${
                          penaltyTrend.isImproving
                            ? "bg-green-50 border-green-200"
                            : penaltyTrend.change > 0
                            ? "bg-red-50 border-red-200"
                            : "bg-gray-50 border-gray-200"
                        }`}>
                          <p className={`text-xs font-semibold ${
                            penaltyTrend.isImproving ? "text-green-700" : 
                            penaltyTrend.change > 0 ? "text-red-700" : "text-gray-700"
                          }`}>
                            {penaltyTrend.isImproving ? "✅ " : penaltyTrend.change > 0 ? "⚠️ " : "→ "}
                            {penaltyTrend.message}
                          </p>
                        </div>
                      )}
                      {penaltyImpact !== null && (
                        <div className="p-2 bg-blue-50 rounded border border-blue-200">
                          <p className="text-xs text-gray-700">
                            <strong>💡 Impact:</strong> Penalties account for {penaltyImpact.toFixed(1)}% of total time. 
                            {penaltyImpact > 20 
                              ? " High impact - focus on penalty reduction"
                              : penaltyImpact > 10
                              ? " Moderate impact - continue penalty management"
                              : " Low impact - penalties well managed"}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Consistency (IQR)</h3>
                    <p className="text-xs text-gray-600 mt-1">Interquartile Range - measure of consistency</p>
                  </div>
                  <button
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    title="How to read this chart"
                    onClick={(e) => {
                      e.preventDefault();
                      alert(`HOW TO READ:\n\n• X-axis: Competition names\n• Y-axis: IQR (Interquartile Range) in seconds\n• Green line: Consistency measure\n• Lower values = more consistent performance\n• Higher values = more variable performance\n\nWhat is IQR?\n- Measures the spread of your times\n- IQR = difference between 75th and 25th percentile\n- Small IQR = consistent (good)\n- Large IQR = inconsistent (needs work)\n\nInterpretation:\n• Lower line = More consistent (better)\n• Higher line = More variable (less consistent)\n• Decreasing trend = Getting more consistent\n• Increasing trend = Getting less consistent\n\nUse this to:\n- Track consistency improvements\n- Identify competitions with high variability\n- See if performance is stabilizing`);
                    }}
                  >
                    ℹ️ How to Read
                  </button>
                </div>
                <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={competitionTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="competitionName" 
                        angle={-45} 
                        textAnchor="end" 
                        height={80}
                        tick={{ fontSize: 10 }}
                        label={{ value: "Competition", position: "insideBottom", offset: -5 }}
                      />
                      <YAxis 
                        tickFormatter={(value) => formatTime(value)}
                        label={{ value: "IQR (seconds)", angle: -90, position: "insideLeft" }}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatTime(value)}
                        labelFormatter={(label) => `Competition: ${label}`}
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
                      />
                      <Legend />
                      {(() => {
                        const iqrs = competitionTrends.map(t => t.consistencyIQR);
                        const avgIQR = iqrs.length > 0
                          ? iqrs.reduce((sum, i) => sum + i, 0) / iqrs.length
                          : null;
                        return avgIQR !== null ? (
                          <ReferenceLine
                            y={avgIQR}
                            stroke="#6b7280"
                            strokeDasharray="5 5"
                            label={{ value: "Avg IQR", position: "right" }}
                          />
                        ) : null;
                      })()}
                      <Line
                        type="monotone"
                        dataKey="consistencyIQR"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ fill: "#10b981", r: 5 }}
                        name="Consistency (IQR)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {(() => {
                  const iqrs = competitionTrends.map(t => t.consistencyIQR);
                  const avgIQR = iqrs.length > 0
                    ? iqrs.reduce((sum, i) => sum + i, 0) / iqrs.length
                    : null;
                  
                  // Calculate trend
                  let consistencyTrend: { change: number; isImproving: boolean; message: string; level: string } | null = null;
                  if (iqrs.length >= 3) {
                    const recent = iqrs.slice(-3);
                    const earlier = iqrs.slice(0, -3);
                    if (earlier.length > 0) {
                      const recentAvg = recent.reduce((sum, i) => sum + i, 0) / recent.length;
                      const earlierAvg = earlier.reduce((sum, i) => sum + i, 0) / earlier.length;
                      const change = recentAvg - earlierAvg;
                      consistencyTrend = {
                        change,
                        isImproving: change < 0,
                        message: change < 0
                          ? `Consistency improving (IQR decreasing by ${formatTime(Math.abs(change))})`
                          : change > 0
                          ? `Consistency declining (IQR increasing by ${formatTime(change)})`
                          : "Consistency stable",
                        level: avgIQR !== null
                          ? avgIQR < 5 ? "excellent" : avgIQR < 10 ? "good" : avgIQR < 15 ? "moderate" : "needs improvement"
                          : "unknown"
                      };
                    }
                  }
                  
                  // Consistency score (lower IQR = better)
                  const maxIQR = iqrs.length > 0 ? Math.max(...iqrs) : null;
                  const consistencyScore = avgIQR !== null && maxIQR !== null && maxIQR > 0
                    ? Math.max(0, Math.round(100 - (avgIQR / maxIQR) * 100))
                    : null;
                  
                  return (
                    <div className="mt-2 space-y-2">
                      {consistencyTrend && (
                        <div className={`p-2 rounded border ${
                          consistencyTrend.isImproving
                            ? "bg-green-50 border-green-200"
                            : consistencyTrend.change > 0
                            ? "bg-red-50 border-red-200"
                            : "bg-gray-50 border-gray-200"
                        }`}>
                          <p className={`text-xs font-semibold ${
                            consistencyTrend.isImproving ? "text-green-700" : 
                            consistencyTrend.change > 0 ? "text-red-700" : "text-gray-700"
                          }`}>
                            {consistencyTrend.isImproving ? "✅ " : consistencyTrend.change > 0 ? "⚠️ " : "→ "}
                            {consistencyTrend.message}
                          </p>
                        </div>
                      )}
                      {consistencyScore !== null && avgIQR !== null && (
                        <div className="p-2 bg-green-50 rounded border border-green-200">
                          <p className="text-xs text-gray-700">
                            <strong>💡 Consistency Score:</strong> {consistencyScore}/100 ({consistencyTrend?.level || "unknown"}). 
                            Average IQR: {formatTime(avgIQR)}. 
                            {avgIQR < 5 
                              ? " Excellent consistency - keep it up!"
                              : avgIQR < 10
                              ? " Good consistency - continue focusing on technique"
                              : avgIQR < 15
                              ? " Moderate consistency - work on standardizing approach"
                              : " Needs improvement - focus on consistent technique"}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Competition Performance Summary */}
            {sortedTrends.length > 0 && latestCompetition && (
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg shadow-lg p-6 border-2 border-indigo-300">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      📈 Performance Summary
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">Latest competition analysis and trends</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg p-5 border-2 border-indigo-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      🎯 Latest Competition
                    </h4>
                    <div className="space-y-2">
                      <p className="text-3xl font-bold text-gray-900">
                        {formatTime(latestCompetition.medianCleanTime)}
                      </p>
                      <p className="text-sm text-gray-600 font-medium">{latestCompetition.competitionName}</p>
                      {comparisonToAverage !== null && (
                        <div className={`mt-3 p-2 rounded-lg ${
                          comparisonToAverage <= 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                        }`}>
                          <p className={`text-sm font-semibold ${
                            comparisonToAverage <= 0 ? "text-green-700" : "text-red-700"
                          }`}>
                            {comparisonToAverage <= 0
                              ? `✓ ${Math.abs(comparisonToAverage).toFixed(1)}% faster than season average`
                              : `${comparisonToAverage.toFixed(1)}% slower than season average`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-5 border-2 border-indigo-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      📊 Trend Analysis
                    </h4>
                    <div className="space-y-2">
                      {sortedTrends.length >= 2 && (() => {
                        // Enhanced multi-point trend analysis
                        const windowSize = Math.min(5, Math.floor(sortedTrends.length / 2));
                        const hasEnoughData = sortedTrends.length >= 4;
                        
                        let trendAnalysis: {
                          change: number;
                          changePercent: number;
                          isImproving: boolean;
                          isSignificant: boolean;
                          trendStrength: "strong" | "moderate" | "weak";
                          message: string;
                        } | null = null;
                        
                        if (hasEnoughData && windowSize >= 2) {
                          const recent = sortedTrends.slice(-windowSize);
                          const earlier = sortedTrends.slice(0, windowSize);
                          
                          const recentAvg = recent.reduce((sum, t) => sum + t.medianCleanTime, 0) / recent.length;
                          const earlierAvg = earlier.reduce((sum, t) => sum + t.medianCleanTime, 0) / earlier.length;
                          
                          const change = recentAvg - earlierAvg;
                          const changePercent = earlierAvg > 0 ? (change / earlierAvg) * 100 : 0;
                          
                          // Calculate standard deviation for significance
                          const recentStdDev = Math.sqrt(
                            recent.reduce((sum, t) => sum + Math.pow(t.medianCleanTime - recentAvg, 2), 0) / recent.length
                          );
                          const earlierStdDev = Math.sqrt(
                            earlier.reduce((sum, t) => sum + Math.pow(t.medianCleanTime - earlierAvg, 2), 0) / earlier.length
                          );
                          
                          // Pooled standard error
                          const pooledStdDev = Math.sqrt((recentStdDev ** 2 + earlierStdDev ** 2) / 2);
                          const standardError = pooledStdDev / Math.sqrt(windowSize);
                          const zScore = standardError > 0 ? Math.abs(change / standardError) : 0;
                          const isSignificant = zScore > 1.96; // 95% confidence
                          
                          const trendStrength = zScore > 2 ? "strong" : zScore > 1 ? "moderate" : "weak";
                          
                          trendAnalysis = {
                            change,
                            changePercent,
                            isImproving: change < 0,
                            isSignificant,
                            trendStrength,
                            message: change < 0
                              ? `Improving by ${formatTime(Math.abs(change))} (${Math.abs(changePercent).toFixed(1)}%)`
                              : change > 0
                              ? `Declining by ${formatTime(change)} (${changePercent.toFixed(1)}%)`
                              : "Stable performance"
                          };
                        } else {
                          // Fallback to simple 2-point comparison
                          const recentTrend = sortedTrends[sortedTrends.length - 1].medianCleanTime - 
                                            sortedTrends[sortedTrends.length - 2].medianCleanTime;
                          trendAnalysis = {
                            change: recentTrend,
                            changePercent: sortedTrends[sortedTrends.length - 2].medianCleanTime > 0
                              ? (recentTrend / sortedTrends[sortedTrends.length - 2].medianCleanTime) * 100
                              : 0,
                            isImproving: recentTrend < 0,
                            isSignificant: false,
                            trendStrength: "weak",
                            message: recentTrend < 0
                              ? `Improving by ${formatTime(Math.abs(recentTrend))}`
                              : recentTrend > 0
                              ? `Declining by ${formatTime(recentTrend)}`
                              : "Stable performance"
                          };
                        }
                        
                        return (
                          <>
                            <p className={`text-2xl font-bold ${
                              trendAnalysis.isImproving ? "text-emerald-600" : 
                              trendAnalysis.change === 0 ? "text-gray-600" : "text-red-600"
                            }`}>
                              {trendAnalysis.isImproving ? "↓" : trendAnalysis.change === 0 ? "→" : "↑"} {trendAnalysis.message}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              {trendAnalysis.isSignificant && (
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                  trendAnalysis.trendStrength === "strong"
                                    ? "bg-green-100 text-green-700 border border-green-300"
                                    : "bg-yellow-100 text-yellow-700 border border-yellow-300"
                                }`}>
                                  {trendAnalysis.trendStrength.toUpperCase()} TREND
                                </span>
                              )}
                              {trendAnalysis.isSignificant && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded border border-blue-300">
                                  Statistically Significant
                                </span>
                              )}
                              {!trendAnalysis.isSignificant && sortedTrends.length >= 4 && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded border border-gray-300">
                                  Not Significant
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              {hasEnoughData 
                                ? `Based on last ${Math.min(5, Math.floor(sortedTrends.length / 2))} vs previous ${Math.min(5, Math.floor(sortedTrends.length / 2))} competitions`
                                : "Compared to previous competition"}
                            </p>
                            <div className={`mt-3 p-2 rounded-lg ${
                              trendAnalysis.isImproving ? "bg-green-50 border border-green-200" : 
                              trendAnalysis.change === 0 ? "bg-gray-50 border border-gray-200" :
                              "bg-red-50 border border-red-200"
                            }`}>
                              <p className="text-xs text-gray-700">
                                {trendAnalysis.isImproving
                                  ? trendAnalysis.isSignificant
                                    ? "✅ Performance is significantly improving - excellent progress!"
                                    : "✅ Performance is improving - keep it up!"
                                  : trendAnalysis.change === 0
                                  ? "→ Maintaining consistent performance"
                                  : trendAnalysis.isSignificant
                                  ? "⚠️ Performance is significantly declining - review technique and training"
                                  : "⚠️ Performance declining - monitor closely"}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                      {sortedTrends.length < 2 && (
                        <p className="text-sm text-gray-500">Need at least 2 competitions for trend analysis</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {mode === "run" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Run Type
              </label>
              <select
                value={selectedRunType}
                onChange={(e) => setSelectedRunType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md"
              >
                {runTypes.map((rt) => (
                  <option key={rt.code} value={rt.code}>
                    {rt.code} - {rt.name}
                  </option>
                ))}
              </select>
            </div>

            {runDiagnostic && (
              <>
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {runDiagnostic.runTypeName} Performance Trend
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">Detailed analysis for this specific run type</p>
                    </div>
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      title="How to read this chart"
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`HOW TO READ:\n\n• X-axis: Competition dates (chronological)\n• Y-axis: Clean time (seconds)\n• Blue area: Your clean times for this run type\n• Green line: Rolling median (trend line)\n• Green dashed lines: IQR bounds (consistency range)\n• Gray dashed line: Average clean time\n• Green dashed line: Best clean time\n\nInterpretation:\n• Area below median line = Better than median\n• Area above median line = Below median\n• IQR lines show consistency range\n• Narrow IQR = consistent performance\n• Wide IQR = variable performance\n\nUse this to:\n- Track performance for specific run types\n- See consistency trends\n- Identify improvement opportunities\n- Compare to your best and average`);
                      }}
                    >
                      ℹ️ How to Read
                    </button>
                  </div>
                  <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                    <ResponsiveContainer width="100%" height={400}>
                      <AreaChart data={runDiagnostic.dataPoints}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="competitionDate"
                          tickFormatter={(date) => formatDate(date)}
                          label={{ value: "Competition Date", position: "insideBottom", offset: -5 }}
                        />
                        <YAxis 
                          tickFormatter={(value) => formatTime(value)}
                          label={{ value: "Clean Time (seconds)", angle: -90, position: "insideLeft" }}
                        />
                        <Tooltip
                          formatter={(value: number) => formatTime(value)}
                          labelFormatter={(date) => `Date: ${formatDate(date)}`}
                          contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
                        />
                        <Legend />
                      {/* Calculate run type benchmarks */}
                      {(() => {
                        const runCleanTimes = runDiagnostic.dataPoints.map((dp) => dp.cleanTime);
                        const runAverage = runCleanTimes.length > 0
                          ? runCleanTimes.reduce((sum, t) => sum + t, 0) / runCleanTimes.length
                          : null;
                        const runBest = runCleanTimes.length > 0 ? Math.min(...runCleanTimes) : null;
                        return (
                          <>
                            {runAverage !== null && (
                              <ReferenceLine
                                y={runAverage}
                                stroke="#6b7280"
                                strokeDasharray="5 5"
                                label={{ value: "Avg", position: "right" }}
                              />
                            )}
                            {runBest !== null && (
                              <ReferenceLine
                                y={runBest}
                                stroke="#10b981"
                                strokeDasharray="3 3"
                                label={{ value: "Best", position: "right" }}
                              />
                            )}
                          </>
                        );
                      })()}
                      <Area
                        type="monotone"
                        dataKey="cleanTime"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.3}
                        name="Clean Time"
                      />
                      {runDiagnostic.rollingMedian.length > 0 && (
                        <Line
                          type="monotone"
                          dataKey="value"
                          data={runDiagnostic.rollingMedian}
                          stroke="#10b981"
                          strokeWidth={3}
                          dot={false}
                          name="Rolling Median (Trend)"
                        />
                      )}
                      {runDiagnostic.rollingIQR.length > 0 && (
                        <>
                          <Line
                            type="monotone"
                            dataKey="upper"
                            data={runDiagnostic.rollingIQR}
                            stroke="#10b981"
                            strokeWidth={1.5}
                            strokeDasharray="5 5"
                            dot={false}
                            name="IQR Upper Bound"
                          />
                          <Line
                            type="monotone"
                            dataKey="lower"
                            data={runDiagnostic.rollingIQR}
                            stroke="#10b981"
                            strokeWidth={1.5}
                            strokeDasharray="5 5"
                            dot={false}
                            name="IQR Lower Bound"
                          />
                        </>
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-gray-700">
                      <strong>💡 Interpretation:</strong> The green trend line shows your performance direction. 
                      IQR bounds show consistency range - narrower = more consistent. 
                      Compare your times to the best and average reference lines.
                    </p>
                  </div>
                </div>
                
                {/* Run Type Benchmarks */}
                {runDiagnostic.dataPoints.length > 0 && (
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-lg p-6 border-2 border-purple-300">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          🎯 {runDiagnostic.runTypeName} Benchmarks
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">Performance metrics for this run type</p>
                      </div>
                      <button
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                        title="How to read these benchmarks"
                        onClick={(e) => {
                          e.preventDefault();
                          alert(`HOW TO READ:\n\n• Best Time: Your fastest time for this run type (goal)\n• Average Time: Your typical performance\n• Worst Time: Your slowest time (avoid)\n\nCompare your latest performance:\n• If latest ≤ Best = At or better than your best!\n• If latest ≤ Average = Better than average\n• If latest > Average = Below average (needs work)\n• If latest > Worst = Significantly below best\n\nUse this to:\n- Set goals based on your best\n- Track progress toward average\n- Identify if you're improving or declining\n- See how close you are to your best`);
                        }}
                      >
                        ℹ️ How to Read
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {(() => {
                        const runCleanTimes = runDiagnostic.dataPoints.map((dp) => dp.cleanTime);
                        const runAverage = runCleanTimes.length > 0
                          ? runCleanTimes.reduce((sum, t) => sum + t, 0) / runCleanTimes.length
                          : null;
                        const runBest = runCleanTimes.length > 0 ? Math.min(...runCleanTimes) : null;
                        const runWorst = runCleanTimes.length > 0 ? Math.max(...runCleanTimes) : null;
                        const latest = runDiagnostic.dataPoints[runDiagnostic.dataPoints.length - 1]?.cleanTime || null;
                        
                        return (
                          <>
                            {runBest !== null && (
                              <div className="bg-white p-4 rounded-lg border-2 border-emerald-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg">🏆</span>
                                  <p className="text-xs font-semibold text-emerald-700 uppercase">Best Time</p>
                                </div>
                                <p className="text-2xl font-bold text-emerald-900">
                                  {formatTime(runBest)}
                                </p>
                                {latest !== null && (
                                  <div className={`mt-3 p-2 rounded-lg ${
                                    latest <= runBest ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"
                                  }`}>
                                    <p className={`text-xs font-semibold ${
                                      latest <= runBest ? "text-green-700" : "text-gray-600"
                                    }`}>
                                      {latest <= runBest
                                        ? "✓ At or better than best!"
                                        : `${formatTime(latest - runBest)} from best`}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                            {runAverage !== null && (
                              <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg">📊</span>
                                  <p className="text-xs font-semibold text-blue-700 uppercase">Average Time</p>
                                </div>
                                <p className="text-2xl font-bold text-blue-900">
                                  {formatTime(runAverage)}
                                </p>
                                {latest !== null && (
                                  <div className={`mt-3 p-2 rounded-lg ${
                                    latest <= runAverage ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                                  }`}>
                                    <p className={`text-xs font-semibold ${
                                      latest <= runAverage ? "text-green-700" : "text-red-700"
                                    }`}>
                                      {latest <= runAverage
                                        ? `✓ ${formatTime(runAverage - latest)} faster than avg`
                                        : `${formatTime(latest - runAverage)} slower than avg`}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                            {runWorst !== null && (
                              <div className="bg-white p-4 rounded-lg border-2 border-red-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg">⚠️</span>
                                  <p className="text-xs font-semibold text-red-700 uppercase">Worst Time</p>
                                </div>
                                <p className="text-2xl font-bold text-red-900">
                                  {formatTime(runWorst)}
                                </p>
                                {latest !== null && (
                                  <div className={`mt-3 p-2 rounded-lg ${
                                    latest < runWorst ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"
                                  }`}>
                                    <p className={`text-xs font-semibold ${
                                      latest < runWorst ? "text-green-700" : "text-gray-600"
                                    }`}>
                                      {latest < runWorst
                                        ? `✓ ${formatTime(runWorst - latest)} better than worst`
                                        : "At worst - needs improvement"}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {coachingSummary && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow-lg p-6 border-2 border-indigo-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                🎓 AI Coaching Summary
              </h2>
              <p className="text-sm text-gray-600 mt-1">Personalized insights and recommendations</p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                coachingSummary.confidence === "high"
                  ? "bg-green-100 text-green-800 border border-green-300"
                  : coachingSummary.confidence === "medium"
                  ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                  : "bg-red-100 text-red-800 border border-red-300"
              }`}
            >
              {coachingSummary.confidence.toUpperCase()} CONFIDENCE
            </span>
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-4 border border-indigo-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">📊 Performance Narrative</h3>
              <p className="text-gray-700 leading-relaxed">{coachingSummary.narrative}</p>
            </div>
            {coachingSummary.keyFindings.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-indigo-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  🔍 Key Findings
                </h3>
                <ul className="space-y-2">
                  {coachingSummary.keyFindings.map((finding, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-700">
                      <span className="text-indigo-600 mt-1">•</span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {coachingSummary.recommendedDrills.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-indigo-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  💪 Recommended Drills
                </h3>
                <div className="space-y-3">
                  {coachingSummary.recommendedDrills.map((drill) => (
                    <div key={drill.drillId} className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                      <p className="font-semibold text-indigo-900">{drill.drillName}</p>
                      <p className="text-sm text-gray-700 mt-1">{drill.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {drivers.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Performance Drivers</h2>
              <p className="text-sm text-gray-600 mt-1">Run types with highest penalty impact</p>
            </div>
            <button
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              title="How to read this table"
              onClick={(e) => {
                e.preventDefault();
                alert(`HOW TO READ:\n\nThis table shows which run types are causing the most penalty problems:\n\n• Run Type: The event code\n• Penalty Count: Number of times penalties occurred\n• Total Penalty Time: Sum of all penalty seconds\n• Top Issues: Most common penalty types\n\nInterpretation:\n• Higher penalty count = More frequent penalties\n• Higher total time = More time lost to penalties\n• Top issues = Specific penalty types to focus on\n\nUse this to:\n- Identify which run types need penalty reduction focus\n- See which penalty types are most common\n- Prioritize training on high-penalty run types\n- Track improvement as penalties decrease`);
              }}
            >
              ℹ️ How to Read
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Run Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Penalty Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Total Penalty Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Top Issues
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {drivers.slice(0, 5).map((driver, idx) => (
                  <tr key={driver.runTypeCode} className={idx === 0 ? "bg-red-50" : idx === 1 ? "bg-orange-50" : ""}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-gray-900">{driver.runTypeCode}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900 font-medium">{driver.penaltyCount}</span>
                      <span className="text-xs text-gray-500 ml-1">occurrences</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-red-600 font-semibold">
                        {formatTime(driver.totalPenaltySeconds)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {driver.taxonomyBreakdown.slice(0, 3).map((t, taxIdx) => (
                          <span
                            key={taxIdx}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded border border-gray-300"
                          >
                            {t.taxonomyCode}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-gray-700">
              <strong>💡 Tip:</strong> Focus training on run types with highest penalty counts and times. 
              The top issues show which penalty types are most common - target these in practice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
