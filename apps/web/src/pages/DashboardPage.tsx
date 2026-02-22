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
import { GoalsManager } from "../components/GoalsManager";
import { Goal, calculateProgress, calculateStatus } from "../lib/goals";
import { generatePerformanceForecast, formatForecast } from "../lib/performanceForecasting";

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
  const [goals, setGoals] = useState<Goal[]>([]);
  const [seasonsError, setSeasonsError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [advancedKpis, setAdvancedKpis] = useState<{
    cleanlinessPercent: number | null;
    penaltyRiskIndex: number | null;
    splitBottleneck: "Setup" | "WaterOn" | null;
  }>({ cleanlinessPercent: null, penaltyRiskIndex: null, splitBottleneck: null });

  // Load seasons first, then set default season
  useEffect(() => {
    setSeasonsError(null);
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
        setSeasonsError("Couldn't load seasons. Please try again.");
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

  // Load goals
  useEffect(() => {
    try {
      const stored = localStorage.getItem("waterways_goals");
      if (stored) {
        const allGoals: Goal[] = JSON.parse(stored);
        const filtered = selectedSeasonId
          ? allGoals.filter(g => !g.seasonId || g.seasonId === selectedSeasonId)
          : allGoals;
        const updatedGoals = filtered.map(goal => {
          const progress = calculateProgress(goal.current, goal.target, goal.type);
          const status = calculateStatus(progress, goal.deadline, goal.type);
          return { ...goal, progress, status };
        });
        setGoals(updatedGoals);
      }
    } catch (error) {
      console.error("Failed to load goals:", error);
    }
  }, [selectedSeasonId]);

  // Load analytics data when season is selected
  useEffect(() => {
    if (!selectedSeasonId) return;

    const seasonParam = selectedSeasonId ? `?seasonId=${selectedSeasonId}` : "";

    setAnalyticsError(null);
    Promise.allSettled([
      api
        .get(`/analytics/competition-trends${seasonParam}`)
        .then((res) => setCompetitionTrends(res.data))
        .catch((err) => {
          console.error("Failed to load competition trends:", err);
          setCompetitionTrends([]);
          setAnalyticsError("Couldn't load dashboard data. Please try again.");
        }),
      api
        .get(`/analytics/drivers${seasonParam}`)
        .then((res) => setDrivers(res.data))
        .catch((err) => {
          console.error("Failed to load drivers:", err);
          setDrivers([]);
          setAnalyticsError("Couldn't load dashboard data. Please try again.");
        }),
      api
        .get(`/analytics/advanced-kpis${seasonParam}`)
        .then((res) => setAdvancedKpis(res.data))
        .catch(() => setAdvancedKpis({ cleanlinessPercent: null, penaltyRiskIndex: null, splitBottleneck: null })),
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

  // Enhanced performance forecasting
  const performanceForecast = generatePerformanceForecast(competitionTrends);

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
          to="/app/analysis"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          View Full Analysis
        </Link>
      </div>

      {/* Error banners */}
      {seasonsError && (
        <div role="alert" className="p-4 rounded-lg border-l-4 bg-red-50 border-red-500 text-red-800">
          <p className="text-sm font-medium">{seasonsError}</p>
          <Link to="/app/competitions" className="text-sm underline mt-1 inline-block">Go to Competitions</Link>
        </div>
      )}
      {analyticsError && !seasonsError && (
        <div role="alert" className="p-4 rounded-lg border-l-4 bg-amber-50 border-amber-500 text-amber-800">
          <p className="text-sm font-medium">{analyticsError}</p>
        </div>
      )}

      {/* No seasons empty state */}
      {!loading.seasons && seasons.length === 0 && !seasonsError && (
        <div className="bg-white rounded-lg shadow-lg p-8 text-center border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No seasons yet</h2>
          <p className="text-gray-600 mb-4">Create a season and add competitions to see diagnostics and trends.</p>
          <Link
            to="/app/competitions"
            className="inline-flex px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Competitions
          </Link>
        </div>
      )}

      {/* Performance Alerts - only when we have seasons */}
      {(loading.seasons || seasons.length > 0) && alerts.length > 0 && (
        <div className="space-y-2" role="alert" aria-live="polite">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              role="alert"
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

      {(loading.seasons || seasons.length > 0) && (
        <>
      {/* Controls: Season & Scenario Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!loading.seasons && seasons.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <label htmlFor="dashboard-season-scope" className="block text-sm font-medium text-gray-700 mb-2">
              Season Scope
            </label>
            <select
              id="dashboard-season-scope"
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
            <label htmlFor="dashboard-scenario" className="block text-sm font-medium text-gray-700 mb-2">
              Scenario Simulation (What-If)
            </label>
            <select
              id="dashboard-scenario"
              value={selectedScenarioId || ""}
              onChange={(e) => setSelectedScenarioId(e.target.value || null)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              aria-describedby="dashboard-scenario-hint"
            >
              <option value="">Baseline (No Scenario)</option>
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
            <p id="dashboard-scenario-hint" className="text-xs text-gray-500 mt-1">
              {selectedScenarioId ? "Comparing baseline vs scenario performance" : "Compare performance if you change variables"}
            </p>
          </div>
        )}
      </div>

      {/* Goals Summary */}
      {goals.length > 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg shadow-lg p-6 border-2 border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                🎯 Goals Overview
              </h2>
              <p className="text-sm text-gray-600 mt-1">Track your progress toward performance goals</p>
            </div>
            <Link
              to="#goals"
              className="text-sm text-purple-600 hover:text-purple-800 font-medium"
            >
              Manage goals below →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(() => {
              const active = goals.filter(g => g.status !== "achieved" && g.status !== "missed");
              const achieved = goals.filter(g => g.status === "achieved");
              const onTrack = goals.filter(g => g.status === "on-track");
              const atRisk = goals.filter(g => g.status === "at-risk");
              
              return (
                <>
                  <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                    <p className="text-3xl font-bold text-blue-900">{active.length}</p>
                    <p className="text-sm text-blue-700 font-medium mt-1">Active Goals</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                    <p className="text-3xl font-bold text-green-900">{achieved.length}</p>
                    <p className="text-sm text-green-700 font-medium mt-1">Achieved</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                    <p className="text-3xl font-bold text-blue-900">{onTrack.length}</p>
                    <p className="text-sm text-blue-700 font-medium mt-1">On Track</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border-2 border-yellow-200">
                    <p className="text-3xl font-bold text-yellow-900">{atRisk.length}</p>
                    <p className="text-sm text-yellow-700 font-medium mt-1">At Risk</p>
                  </div>
                </>
              );
            })()}
          </div>
          {goals.filter(g => g.status === "on-track" || g.status === "at-risk").length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold text-gray-700">Recent Progress:</p>
              {goals
                .filter(g => g.status === "on-track" || g.status === "at-risk")
                .slice(0, 3)
                .map(goal => (
                  <div key={goal.id} className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{goal.title}</span>
                      <span className="text-xs font-semibold text-gray-600">{goal.progress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          goal.status === "on-track" ? "bg-blue-500" : "bg-yellow-500"
                        }`}
                        style={{ width: `${Math.min(100, goal.progress)}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Performance Score & Quick Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-lg shadow-lg border border-indigo-200" aria-label={`Performance score ${Math.round(performanceScore)} out of 100`}>
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

        {performanceForecast && (
          <div className="bg-gradient-to-br from-violet-50 to-violet-100 p-6 rounded-lg shadow-lg border border-violet-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-violet-900">📊 Performance Forecast</h3>
              <span className={`text-xs px-2 py-1 rounded ${
                performanceForecast.nextCompetitionPrediction.confidence === "high" ? "bg-green-200 text-green-800" :
                performanceForecast.nextCompetitionPrediction.confidence === "medium" ? "bg-yellow-200 text-yellow-800" :
                "bg-gray-200 text-gray-800"
              }`}>
                {performanceForecast.nextCompetitionPrediction.confidence.toUpperCase()} Confidence
              </span>
            </div>
            
            {/* Next Competition Prediction */}
            <div className="mb-4">
              <p className="text-xs text-violet-600 mb-2">Next Competition Prediction</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white p-3 rounded">
                  <p className="text-xs text-gray-500">Optimistic</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatTime(performanceForecast.nextCompetitionPrediction.timeRange.optimistic)}
                  </p>
                </div>
                <div className="bg-white p-3 rounded border-2 border-violet-300">
                  <p className="text-xs text-gray-500">Realistic</p>
                  <p className="text-lg font-bold text-violet-900">
                    {formatTime(performanceForecast.nextCompetitionPrediction.timeRange.realistic)}
                  </p>
                </div>
                <div className="bg-white p-3 rounded">
                  <p className="text-xs text-gray-500">Pessimistic</p>
                  <p className="text-lg font-bold text-red-600">
                    {formatTime(performanceForecast.nextCompetitionPrediction.timeRange.pessimistic)}
                  </p>
                </div>
              </div>
            </div>

            {/* Metric Forecasts */}
            <div className="space-y-2 mb-4">
              <div className="bg-white p-3 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Time Performance</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    performanceForecast.timeForecast.trend === "improving" ? "bg-green-100 text-green-700" :
                    performanceForecast.timeForecast.trend === "declining" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {performanceForecast.timeForecast.trend === "improving" ? "↓ Improving" :
                     performanceForecast.timeForecast.trend === "declining" ? "↑ Declining" : "→ Stable"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatForecast(performanceForecast.timeForecast)}
                </p>
              </div>
              
              <div className="bg-white p-3 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Penalty Load</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    performanceForecast.penaltyForecast.trend === "improving" ? "bg-green-100 text-green-700" :
                    performanceForecast.penaltyForecast.trend === "declining" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {performanceForecast.penaltyForecast.trend === "improving" ? "↓ Improving" :
                     performanceForecast.penaltyForecast.trend === "declining" ? "↑ Declining" : "→ Stable"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatForecast(performanceForecast.penaltyForecast)}
                </p>
              </div>
              
              <div className="bg-white p-3 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Consistency</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    performanceForecast.consistencyForecast.trend === "improving" ? "bg-green-100 text-green-700" :
                    performanceForecast.consistencyForecast.trend === "declining" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {performanceForecast.consistencyForecast.trend === "improving" ? "↓ Improving" :
                     performanceForecast.consistencyForecast.trend === "declining" ? "↑ Declining" : "→ Stable"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatForecast(performanceForecast.consistencyForecast)}
                </p>
              </div>
            </div>

            {/* Improvement Opportunities */}
            {performanceForecast.improvementOpportunities.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-violet-700 mb-2">💡 Improvement Opportunities</p>
                <div className="space-y-2">
                  {performanceForecast.improvementOpportunities.slice(0, 2).map((opp, idx) => (
                    <div key={idx} className="bg-white p-2 rounded text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-700">{opp.metric}</span>
                        <span className="text-green-600 font-semibold">
                          Potential: {opp.potentialGain.toFixed(1)}s
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs">
                        {opp.actionItems[0]} • {(opp.probability * 100).toFixed(0)}% probability
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Assessment */}
            {performanceForecast.riskAssessment.overallRisk !== "low" && (
              <div className="bg-white p-3 rounded border-l-4 border-yellow-400">
                <p className="text-xs font-medium text-yellow-800 mb-1">
                  ⚠️ Risk Assessment: {performanceForecast.riskAssessment.overallRisk.toUpperCase()}
                </p>
                <p className="text-xs text-gray-600">
                  {performanceForecast.riskAssessment.risks[0]?.description}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Advanced analytics: Cleanliness KPI, Penalty Risk Index, Split Bottleneck */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-lg shadow-lg border border-teal-200" aria-label={advancedKpis.cleanlinessPercent != null ? `Clean runs ${advancedKpis.cleanlinessPercent}% in last 14 days` : "Cleanliness KPI loading or no data"}>
          <h3 className="text-sm font-medium text-teal-700">Cleanliness KPI</h3>
          {loading.trends ? (
            <div className="text-sm text-gray-500 mt-2">Loading...</div>
          ) : advancedKpis.cleanlinessPercent != null ? (
            <>
              <p className="text-3xl font-bold text-teal-900 mt-2">{advancedKpis.cleanlinessPercent}%</p>
              <p className="text-xs text-teal-600 mt-1">CLEAN runs (last 14 days)</p>
            </>
          ) : (
            <p className="text-lg text-gray-400 mt-2">—</p>
          )}
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-lg shadow-lg border border-orange-200" aria-label={advancedKpis.penaltyRiskIndex != null ? `Penalty risk index ${advancedKpis.penaltyRiskIndex}` : "Penalty risk index loading or no data"}>
          <h3 className="text-sm font-medium text-orange-700">Penalty Risk Index</h3>
          {loading.trends ? (
            <div className="text-sm text-gray-500 mt-2">Loading...</div>
          ) : advancedKpis.penaltyRiskIndex != null ? (
            <>
              <p className="text-3xl font-bold text-orange-900 mt-2">{advancedKpis.penaltyRiskIndex}</p>
              <p className="text-xs text-orange-600 mt-1">Weighted avg (MINOR=1, MAJOR=3, RISK=5)</p>
            </>
          ) : (
            <p className="text-lg text-gray-400 mt-2">—</p>
          )}
        </div>
        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-6 rounded-lg shadow-lg border border-cyan-200" aria-label={advancedKpis.splitBottleneck != null ? `Split bottleneck: ${advancedKpis.splitBottleneck}` : "Split bottleneck loading or no data"}>
          <h3 className="text-sm font-medium text-cyan-700">Split Bottleneck</h3>
          {loading.trends ? (
            <div className="text-sm text-gray-500 mt-2">Loading...</div>
          ) : advancedKpis.splitBottleneck != null ? (
            <>
              <p className="text-3xl font-bold text-cyan-900 mt-2">{advancedKpis.splitBottleneck}</p>
              <p className="text-xs text-cyan-600 mt-1">Highest median (last 10 runs)</p>
            </>
          ) : (
            <p className="text-lg text-gray-400 mt-2">—</p>
          )}
        </div>
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
                Estimated time you could gain by reducing penalties and variance
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
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick links</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to={`/app/analysis?mode=run&runType=${drivers.length > 0 ? drivers[0].runTypeCode : "A1"}`}
            className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            <div className="text-blue-700 font-semibold text-sm">Run Diagnostics</div>
            <div className="text-xs text-blue-600 mt-1">
              {drivers.length > 0 ? `Analyze ${drivers[0].runTypeCode}` : "View run analysis"}
            </div>
          </Link>
          <Link
            to="/app/analysis?mode=competition"
            className="p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
          >
            <div className="text-green-700 font-semibold text-sm">Trend Analysis</div>
            <div className="text-xs text-green-600 mt-1">View full trends</div>
          </Link>
          {topIssues.length > 0 && (
            <Link
              to="/app/penalties"
              className="p-4 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
            >
              <div className="text-red-700 font-semibold text-sm">Fix Top Issue</div>
              <div className="text-xs text-red-600 mt-1">{topIssues[0].taxonomyCode}</div>
            </Link>
          )}
          {selectedSeasonId && (
            <Link
              to={`/app/competitions?seasonId=${selectedSeasonId}`}
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
              to="/app/competitions"
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
              <Link to="/app/competitions/new" className="text-blue-600 hover:underline">
                Create one
              </Link>
            </div>
          ) : (
            recentCompetitions.map((comp) => (
              <Link
                key={comp.id}
                to={`/app/competitions/${comp.id}`}
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

      {/* Goals & Targets Section */}
      <div id="goals" className="bg-white rounded-lg shadow-lg p-6">
        <GoalsManager 
          seasonId={selectedSeasonId}
          competitionTrends={competitionTrends}
          onGoalUpdate={() => {
            // Reload goals when updated
            try {
              const stored = localStorage.getItem("waterways_goals");
              if (stored) {
                const allGoals: Goal[] = JSON.parse(stored);
                const filtered = selectedSeasonId
                  ? allGoals.filter(g => !g.seasonId || g.seasonId === selectedSeasonId)
                  : allGoals;
                const updatedGoals = filtered.map(goal => {
                  const progress = calculateProgress(goal.current, goal.target, goal.type);
                  const status = calculateStatus(progress, goal.deadline, goal.type);
                  return { ...goal, progress, status };
                });
                setGoals(updatedGoals);
              }
            } catch (error) {
              console.error("Failed to reload goals:", error);
            }
          }}
        />
      </div>
        </>
      )}
    </div>
  );
}
