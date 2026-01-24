import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import api from "../lib/api";
import { formatDate, formatTime } from "../lib/utils";
import type { CompetitionTrend, DriverAnalysis } from "@waterways/shared";

interface Season {
  id: string;
  name: string;
  year: number;
  competitions: Competition[];
}

interface Competition {
  id: string;
  name: string;
  date: string;
  location?: string;
  runResults?: any[];
  _count?: { runResults: number };
}

interface LoadingState {
  seasons: boolean;
  trends: boolean;
  drivers: boolean;
}

interface Scenario {
  id: string;
  name: string;
  notes?: string;
}

export function DashboardPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [competitionTrends, setCompetitionTrends] = useState<CompetitionTrend[]>([]);
  const [drivers, setDrivers] = useState<DriverAnalysis[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [scenarioTrends, setScenarioTrends] = useState<CompetitionTrend[]>([]);
  const [loading, setLoading] = useState<LoadingState>({
    seasons: true,
    trends: true,
    drivers: true,
  });

  // Load seasons first, then set default season
  useEffect(() => {
    api
      .get("/seasons")
      .then((res) => {
        const seasonsData = res.data as Season[];
        setSeasons(seasonsData);
        // Set default to latest season by year
        if (seasonsData.length > 0 && !selectedSeasonId) {
          const latestSeason = [...seasonsData].sort((a, b) => b.year - a.year)[0];
          setSelectedSeasonId(latestSeason.id);
        }
      })
      .catch((err) => {
        console.error("Failed to load seasons:", err);
      })
      .finally(() => {
        setLoading((prev) => ({ ...prev, seasons: false }));
      });
  }, []);

  // Load scenarios
  useEffect(() => {
    api
      .get("/scenarios")
      .then((res) => setScenarios(res.data))
      .catch((err) => {
        console.error("Failed to load scenarios:", err);
        setScenarios([]);
      });
  }, []);

  // Load analytics data when season is selected
  useEffect(() => {
    if (!selectedSeasonId) return;

    const seasonParam = selectedSeasonId ? `?seasonId=${selectedSeasonId}` : "";

    Promise.allSettled([
      api
        .get(`/analytics/competition-trends${seasonParam}`)
        .then((res) => setCompetitionTrends(res.data))
        .catch((err) => {
          console.error("Failed to load competition trends:", err);
          setCompetitionTrends([]);
        }),
      api
        .get(`/analytics/drivers${seasonParam}`)
        .then((res) => setDrivers(res.data))
        .catch((err) => {
          console.error("Failed to load drivers:", err);
          setDrivers([]);
        }),
    ]).finally(() => {
      setLoading((prev) => ({ ...prev, trends: false, drivers: false }));
    });
  }, [selectedSeasonId]);

  // Load scenario comparison when scenario is selected
  useEffect(() => {
    if (!selectedScenarioId || !selectedSeasonId) {
      setScenarioTrends([]);
      return;
    }

    const seasonParam = selectedSeasonId ? `?seasonId=${selectedSeasonId}&scenarioId=${selectedScenarioId}` : `?scenarioId=${selectedScenarioId}`;
    api
      .get(`/analytics/competition-trends${seasonParam}`)
      .then((res) => setScenarioTrends(res.data))
      .catch((err) => {
        console.error("Failed to load scenario trends:", err);
        setScenarioTrends([]);
      });
  }, [selectedScenarioId, selectedSeasonId]);

  const recentCompetitions = seasons
    .flatMap((s) => s.competitions)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Calculate performance trends
  const sortedTrends = [...competitionTrends].sort(
    (a, b) => new Date(a.competitionDate).getTime() - new Date(b.competitionDate).getTime()
  );
  const recentTrends = sortedTrends.slice(-6); // Last 6 competitions

  // Build lookup map for performance
  const trendByCompetitionId = new Map<string, CompetitionTrend>();
  competitionTrends.forEach((trend) => {
    trendByCompetitionId.set(trend.competitionId, trend);
  });

  // Calculate performance trend with correct direction
  const performanceTrend =
    recentTrends.length >= 2
      ? recentTrends[recentTrends.length - 1].medianCleanTime -
        recentTrends[recentTrends.length - 2].medianCleanTime
      : 0;
  // Decreasing time = improving (show ↓ green), increasing time = declining (show ↑ red)
  const isImproving = performanceTrend < 0;
  const trendDelta = Math.abs(performanceTrend);

  // Median clean time from last 6 competitions
  const calculateMedian = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  };
  const medianCleanTimeLast6 = calculateMedian(
    recentTrends.map((t) => t.medianCleanTime)
  );

  // Calculate total penalty time
  const totalPenaltyTime = competitionTrends.reduce((sum, t) => sum + t.penaltyLoad, 0);
  const avgPenaltyRate =
    competitionTrends.length > 0
      ? competitionTrends.reduce((sum, t) => sum + t.penaltyRate, 0) / competitionTrends.length
      : 0;

  // Recoverable time estimate
  const lastTrend = recentTrends[recentTrends.length - 1];
  const recoverableTimeEstimate = lastTrend
    ? lastTrend.penaltyLoad + 0.5 * lastTrend.consistencyIQR
    : 0;

  // Top 3 issues
  const topIssues =
    drivers.length > 0 && drivers[0].taxonomyBreakdown.length > 0
      ? drivers[0].taxonomyBreakdown
          .sort((a, b) => b.totalSeconds - a.totalSeconds)
          .slice(0, 3)
      : [];

  // Calculate benchmarks and predictions
  const bestCleanTime = recentTrends.length > 0
    ? Math.min(...recentTrends.map((t) => t.medianCleanTime))
    : 0;
  const worstCleanTime = recentTrends.length > 0
    ? Math.max(...recentTrends.map((t) => t.medianCleanTime))
    : 0;
  const currentCleanTime = lastTrend?.medianCleanTime || 0;

  // Performance score (0-100): based on how close to best performance
  const performanceScore = bestCleanTime > 0 && currentCleanTime > 0 && worstCleanTime !== bestCleanTime
    ? Math.max(0, Math.min(100, ((worstCleanTime - currentCleanTime) / (worstCleanTime - bestCleanTime)) * 100))
    : bestCleanTime > 0 && currentCleanTime > 0 && worstCleanTime === bestCleanTime
    ? 100  // All performances are the same, so perfect score
    : 50;  // Default when no data

  // Simple trend-based prediction (linear extrapolation)
  const predictNextCompetition = (): number | null => {
    if (recentTrends.length < 3) return null;
    const last3 = recentTrends.slice(-3);
    const trend = (last3[2].medianCleanTime - last3[0].medianCleanTime) / 2;
    return Math.max(0, last3[2].medianCleanTime + trend);
  };
  const predictedNext = predictNextCompetition();

  // Calculate scenario impact if scenario is selected
  const scenarioImpact = selectedScenarioId && scenarioTrends.length > 0 && competitionTrends.length > 0
    ? {
        baselineMedian: medianCleanTimeLast6,
        scenarioMedian: calculateMedian(scenarioTrends.slice(-6).map((t) => t.medianCleanTime)),
        improvement: medianCleanTimeLast6 - calculateMedian(scenarioTrends.slice(-6).map((t) => t.medianCleanTime)),
      }
    : null;

  // Performance alerts
  const alerts: Array<{ type: "warning" | "critical" | "info"; message: string }> = [];
  if (avgPenaltyRate > 0.5) {
    alerts.push({
      type: "critical",
      message: `High penalty rate: ${(avgPenaltyRate * 100).toFixed(0)}% of runs have penalties`,
    });
  }
  if (recentTrends.length >= 3 && performanceTrend > 5) {
    alerts.push({
      type: "warning",
      message: `Performance declining: ${formatTime(performanceTrend)} slower than previous competition`,
    });
  }
  if (recoverableTimeEstimate > 30) {
    alerts.push({
      type: "info",
      message: `Significant recoverable time: ${formatTime(recoverableTimeEstimate)} potential improvement`,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Diagnostics Cockpit</h1>
          <p className="text-gray-600 mt-1">Performance diagnostics and actionable insights</p>
        </div>
        <Link
          to="/analysis"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          View Full Analysis
        </Link>
      </div>

      {/* Performance Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border-l-4 ${
                alert.type === "critical"
                  ? "bg-red-50 border-red-500 text-red-800"
                  : alert.type === "warning"
                  ? "bg-amber-50 border-amber-500 text-amber-800"
                  : "bg-blue-50 border-blue-500 text-blue-800"
              }`}
            >
              <div className="flex items-center">
                <span className="font-semibold mr-2">
                  {alert.type === "critical" ? "⚠️" : alert.type === "warning" ? "⚡" : "ℹ️"}
                </span>
                <span className="text-sm">{alert.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Controls: Season & Scenario Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!loading.seasons && seasons.length > 0 && (
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

        {scenarios.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scenario Simulation (What-If)
            </label>
            <select
              value={selectedScenarioId || ""}
              onChange={(e) => setSelectedScenarioId(e.target.value || null)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">Baseline (No Scenario)</option>
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
            {selectedScenarioId && (
              <p className="text-xs text-gray-500 mt-1">
                Comparing baseline vs scenario performance
              </p>
            )}
          </div>
        )}
      </div>

      {/* Performance Score & Quick Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-lg shadow-lg border border-indigo-200">
          <h3 className="text-sm font-medium text-indigo-700">Performance Score</h3>
          <div className="mt-4">
            <div className="flex items-baseline">
              <span className="text-5xl font-bold text-indigo-900">
                {Math.round(performanceScore)}
              </span>
              <span className="text-lg text-indigo-600 ml-2">/100</span>
            </div>
            <div className="mt-2 w-full bg-indigo-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${
                  performanceScore >= 80
                    ? "bg-green-500"
                    : performanceScore >= 60
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${performanceScore}%` }}
              />
            </div>
            <p className="text-xs text-indigo-600 mt-2">
              {performanceScore >= 80
                ? "Excellent performance"
                : performanceScore >= 60
                ? "Good performance"
                : "Needs improvement"}
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-lg shadow-lg border border-emerald-200">
          <h3 className="text-sm font-medium text-emerald-700">Best Performance</h3>
          {recentTrends.length > 0 ? (
            <>
              <p className="text-3xl font-bold text-emerald-900 mt-2">
                {formatTime(bestCleanTime)}
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                Best median clean time (last 6)
              </p>
              {currentCleanTime > 0 && (
                <p className="text-xs text-emerald-700 mt-2 font-semibold">
                  {formatTime(currentCleanTime - bestCleanTime)} from best
                </p>
              )}
            </>
          ) : (
            <p className="text-lg text-gray-400 mt-2">—</p>
          )}
        </div>

        {predictedNext !== null && (
          <div className="bg-gradient-to-br from-violet-50 to-violet-100 p-6 rounded-lg shadow-lg border border-violet-200">
            <h3 className="text-sm font-medium text-violet-700">Next Competition Forecast</h3>
            <p className="text-3xl font-bold text-violet-900 mt-2">
              {formatTime(predictedNext)}
            </p>
            <p className="text-xs text-violet-600 mt-1">
              Predicted median clean time
            </p>
            {currentCleanTime > 0 && (
              <p className="text-xs text-violet-700 mt-2">
                {predictedNext < currentCleanTime ? "↓ Improving" : "↑ Declining"}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Scenario Impact Comparison */}
      {scenarioImpact && (
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-lg p-6 border border-purple-200">
          <h2 className="text-xl font-semibold text-purple-900 mb-4">
            Scenario Impact Analysis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg">
              <p className="text-xs text-gray-500">Baseline Median</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatTime(scenarioImpact.baselineMedian)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-xs text-gray-500">Scenario Median</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">
                {formatTime(scenarioImpact.scenarioMedian)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-xs text-gray-500">Potential Improvement</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatTime(scenarioImpact.improvement)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {scenarioImpact.baselineMedian > 0
                  ? `${((scenarioImpact.improvement / scenarioImpact.baselineMedian) * 100).toFixed(1)}% faster`
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg shadow-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-700">
                Median Clean Time (last 6 competitions)
              </h3>
              {loading.trends ? (
                <div className="text-sm text-gray-500 mt-2">Loading...</div>
              ) : recentTrends.length > 0 ? (
                <>
                  <p className="text-3xl font-bold text-blue-900 mt-2">
                    {formatTime(medianCleanTimeLast6)}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    {recentTrends.length} competitions
                  </p>
                </>
              ) : (
                <p className="text-lg text-gray-400 mt-2">—</p>
              )}
            </div>
            {recentTrends.length >= 2 && trendDelta > 0 && (
              <div className="flex flex-col items-end ml-2">
                <div
                  className={`text-2xl ${isImproving ? "text-green-600" : "text-red-600"}`}
                  title={isImproving ? "Improving" : "Declining"}
                >
                  {isImproving ? "↓" : "↑"}
                </div>
                <span
                  className={`text-xs font-semibold mt-1 ${isImproving ? "text-green-600" : "text-red-600"}`}
                >
                  {formatTime(trendDelta)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-lg shadow-lg border border-red-200">
          <h3 className="text-sm font-medium text-red-700">Total Penalty Time</h3>
          {loading.trends ? (
            <div className="text-sm text-gray-500 mt-2">Loading...</div>
          ) : (
            <>
              <p className="text-3xl font-bold text-red-900 mt-2">
                {formatTime(totalPenaltyTime)}
              </p>
              <p className="text-xs text-red-600 mt-1">
                {((avgPenaltyRate * 100).toFixed(0))}% penalty rate
              </p>
            </>
          )}
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg shadow-lg border border-purple-200">
          <h3 className="text-sm font-medium text-purple-700">Recoverable Time (est.)</h3>
          {loading.trends ? (
            <div className="text-sm text-gray-500 mt-2">Loading...</div>
          ) : lastTrend ? (
            <>
              <p className="text-3xl font-bold text-purple-900 mt-2">
                {formatTime(recoverableTimeEstimate)}
              </p>
              <p className="text-xs text-purple-600 mt-1">
                Estimate: penalties + 50% variance
              </p>
            </>
          ) : (
            <p className="text-lg text-gray-400 mt-2">—</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-lg shadow-lg border border-amber-200">
          <h3 className="text-sm font-medium text-amber-700">Top Issue</h3>
          {loading.drivers ? (
            <div className="text-sm text-gray-500 mt-2">Loading...</div>
          ) : topIssues.length > 0 ? (
            <>
              <p className="text-lg font-semibold text-amber-900 mt-2">
                {topIssues[0].taxonomyCode}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                {formatTime(topIssues[0].totalSeconds)} lost, {topIssues[0].count} times
              </p>
            </>
          ) : (
            <p className="text-lg text-gray-400 mt-2">—</p>
          )}
        </div>
      </div>

      {/* Performance Trend Chart with Scenario Overlay */}
      {loading.trends ? (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Performance Trend</h2>
          </div>
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            Loading trend data...
          </div>
        </div>
      ) : recentTrends.length > 0 ? (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Performance Trend</h2>
            <div className="flex items-center gap-4">
              {selectedScenarioId && (
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                  Scenario Active
                </span>
              )}
              <span className="text-sm text-gray-500">Last {recentTrends.length} competitions</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={recentTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="competitionName"
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
              />
              <YAxis tickFormatter={(value) => formatTime(value)} />
              <Tooltip
                formatter={(value: number) => formatTime(value)}
                labelFormatter={(label) => `Competition: ${label}`}
                contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="medianCleanTime"
                stroke={selectedScenarioId ? "#8b5cf6" : "#3b82f6"}
                strokeWidth={3}
                dot={{ fill: selectedScenarioId ? "#8b5cf6" : "#3b82f6", r: 4 }}
                name={selectedScenarioId ? "Scenario Median" : "Baseline Median"}
              />
              {selectedScenarioId && scenarioTrends.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="medianCleanTime"
                  data={scenarioTrends
                    .sort(
                      (a, b) =>
                        new Date(a.competitionDate).getTime() -
                        new Date(b.competitionDate).getTime()
                    )
                    .slice(-6)}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: "#3b82f6", r: 3 }}
                  name="Baseline (dashed)"
                />
              )}
              <Line
                type="monotone"
                dataKey="penaltyLoad"
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "#ef4444", r: 3 }}
                name="Penalty Load"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Performance Trend</h2>
          <div className="h-[300px] flex items-center justify-center text-gray-500">
            No trend data available for selected season
          </div>
        </div>
      )}

      {/* Top Issues Breakdown */}
      {loading.drivers ? (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Performance Issues</h2>
          <div className="h-[250px] flex items-center justify-center text-gray-500">
            Loading issue analysis...
          </div>
        </div>
      ) : topIssues.length > 0 ? (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Performance Issues</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topIssues} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => formatTime(value)} />
              <YAxis
                dataKey="taxonomyCode"
                type="category"
                width={150}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => formatTime(value)}
                contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
              />
              <Bar dataKey="totalSeconds" fill="#ef4444" radius={[0, 4, 4, 0]}>
                {topIssues.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      index === 0
                        ? "#dc2626"
                        : index === 1
                        ? "#f87171"
                        : "#fca5a5"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {topIssues.map((issue, idx) => (
              <div key={idx} className="text-center p-3 bg-gray-50 rounded">
                <p className="text-xs text-gray-500">{issue.taxonomyCode}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  {formatTime(issue.totalSeconds)}
                </p>
                <p className="text-xs text-gray-500">{issue.count} occurrences</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Performance Issues</h2>
          <div className="h-[250px] flex items-center justify-center text-gray-500">
            No issue data available for selected season
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Diagnostics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to={`/analysis?mode=run&runType=${drivers.length > 0 ? drivers[0].runTypeCode : "A1"}`}
            className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            <div className="text-blue-700 font-semibold text-sm">Run Diagnostics</div>
            <div className="text-xs text-blue-600 mt-1">
              {drivers.length > 0 ? `Analyze ${drivers[0].runTypeCode}` : "View run analysis"}
            </div>
          </Link>
          <Link
            to="/analysis?mode=competition"
            className="p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
          >
            <div className="text-green-700 font-semibold text-sm">Trend Analysis</div>
            <div className="text-xs text-green-600 mt-1">View full trends</div>
          </Link>
          {topIssues.length > 0 && (
            <Link
              to="/penalties"
              className="p-4 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
            >
              <div className="text-red-700 font-semibold text-sm">Fix Top Issue</div>
              <div className="text-xs text-red-600 mt-1">{topIssues[0].taxonomyCode}</div>
            </Link>
          )}
          {selectedSeasonId && (
            <Link
              to={`/competitions?seasonId=${selectedSeasonId}`}
              className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors"
            >
              <div className="text-purple-700 font-semibold text-sm">Season Details</div>
              <div className="text-xs text-purple-600 mt-1">View competitions</div>
            </Link>
          )}
        </div>
      </div>

      {/* Recent Competitions with Performance Indicators */}
      <div className="bg-white rounded-lg shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Recent Competitions</h2>
            <Link
              to="/competitions"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All →
            </Link>
          </div>
        </div>
        <div className="divide-y">
          {recentCompetitions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No competitions yet.{" "}
              <Link to="/competitions" className="text-blue-600 hover:underline">
                Create one
              </Link>
            </div>
          ) : (
            recentCompetitions.map((comp) => (
              <Link
                key={comp.id}
                to={`/competitions/${comp.id}`}
                className="block p-6 hover:bg-gray-50"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-gray-900">{comp.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDate(comp.date)} {comp.location && `• ${comp.location}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-3">
                      {trendByCompetitionId.has(comp.id) && (
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            {formatTime(trendByCompetitionId.get(comp.id)!.medianCleanTime)}
                          </div>
                          <div className="text-xs text-gray-500">median clean</div>
                        </div>
                      )}
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {(comp._count?.runResults ?? comp.runResults?.length ?? 0)}
                        </div>
                        <div className="text-xs text-gray-500">runs</div>
                      </div>
                    </div>
                    {trendByCompetitionId.has(comp.id) && (
                      <div className="mt-2 flex gap-2 justify-end">
                        {(() => {
                          const trend = trendByCompetitionId.get(comp.id)!;
                          return (
                            <>
                              {trend.penaltyRate > 0 && (
                                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                                  {(trend.penaltyRate * 100).toFixed(0)}% penalties
                                </span>
                              )}
                              {trend.consistencyIQR > 0 && (
                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                  IQR: {formatTime(trend.consistencyIQR)}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
