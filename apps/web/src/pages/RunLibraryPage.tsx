import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import api from "../lib/api";
import { formatTime } from "../lib/utils";
import type { RunDiagnostic, DriverAnalysis } from "@waterways/shared";

interface RunType {
  id: string;
  code: string;
  name: string;
  description?: string;
}

interface RunSpec {
  runType: { id: string; code: string; name: string };
  spec: {
    id: string;
    jsonSpec: any;
    markdownPath?: string;
  } | null;
}

interface Season {
  id: string;
  name: string;
  year: number;
}

// ============================================================================
// UTILITY FUNCTIONS: Robust Statistics
// ============================================================================

function median(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(numbers: number[], p: number): number | null {
  if (numbers.length === 0) return null;
  if (p < 0 || p > 1) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = p * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function iqr(numbers: number[]): number | null {
  const p25 = percentile(numbers, 0.25);
  const p75 = percentile(numbers, 0.75);
  if (p25 === null || p75 === null) return null;
  return p75 - p25;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RunLibraryPage() {
  const [runTypes, setRunTypes] = useState<RunType[]>([]);
  const [selectedRunType, setSelectedRunType] = useState<string>("");
  const [runSpec, setRunSpec] = useState<RunSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runDiagnostic, setRunDiagnostic] = useState<RunDiagnostic | null>(null);
  const [drivers, setDrivers] = useState<DriverAnalysis[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [loadingSpec, setLoadingSpec] = useState(false);
  const [seasonsError, setSeasonsError] = useState<string | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [loadingMarkdown, setLoadingMarkdown] = useState(false);

  // Memoized maps for performance
  const driverByRunTypeCode = useMemo(() => {
    const map = new Map<string, DriverAnalysis>();
    drivers.forEach((d) => map.set(d.runTypeCode, d));
    return map;
  }, [drivers]);

  const runTypeByCode = useMemo(() => {
    const map = new Map<string, RunType>();
    runTypes.forEach((rt) => map.set(rt.code, rt));
    return map;
  }, [runTypes]);

  // Load initial data with Promise.allSettled
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSeasonsError(null);

    Promise.allSettled([
      api.get("/run-types").then((res) => res.data),
      api.get("/seasons").then((res) => res.data as Season[]),
    ])
      .then(([runTypesResult, seasonsResult]) => {
        if (cancelled) return;

        if (runTypesResult.status === "fulfilled") {
          setRunTypes(runTypesResult.value);
          if (runTypesResult.value.length > 0) {
            setSelectedRunType(runTypesResult.value[0].code);
          } else {
            setError("No run types found. Please seed the database.");
          }
        } else {
          const reason = runTypesResult.reason;
          console.error("Failed to load run types:", reason);
          const errorData = reason?.response?.data;
          const errorMessage = errorData?.message || errorData?.error || reason?.message || "Unknown error";
          const statusCode = reason?.response?.status;
          
          if (statusCode === 401) {
            setError("Authentication failed. Please log in again.");
          } else if (statusCode === 404) {
            setError("API endpoint not found. Check that the API server is running.");
          } else if (statusCode >= 500) {
            // Show detailed error message from improved error handler
            const detailedError = errorData?.message || errorData?.error || "Server error. Check API server logs.";
            setError(`Database error: ${detailedError}${errorData?.table ? ` (Table: ${errorData.table})` : ""}${errorData?.code ? ` (Code: ${errorData.code})` : ""}`);
          } else {
            setError(`Failed to load run types: ${errorMessage} (Status: ${statusCode || "Network Error"})`);
          }
        }

        if (seasonsResult.status === "fulfilled") {
          setSeasons(seasonsResult.value);
          if (seasonsResult.value.length > 0 && !selectedSeasonId) {
            const latestSeason = [...seasonsResult.value].sort((a, b) => b.year - a.year)[0];
            setSelectedSeasonId(latestSeason.id);
          }
        } else {
          const reason = seasonsResult.reason;
          console.error("Failed to load seasons:", reason);
          const errorData = reason?.response?.data;
          const errorMessage = errorData?.message || errorData?.error || reason?.message || "Unknown error";
          const statusCode = reason?.response?.status;
          
          if (statusCode >= 500) {
            const detailedError = errorData?.message || errorData?.error || "Server error";
            setSeasonsError(`Database error: ${detailedError}${errorData?.table ? ` (Table: ${errorData.table})` : ""}. Penalty drivers may not be available.`);
          } else {
            setSeasonsError(`Failed to load seasons: ${errorMessage}. Penalty drivers may not be available.`);
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Load drivers analysis (filtered by season)
  useEffect(() => {
    if (!selectedSeasonId) {
      setDrivers([]);
      return;
    }

    let cancelled = false;
    const seasonParam = `?seasonId=${selectedSeasonId}`;

    api
      .get(`/analytics/drivers${seasonParam}`)
      .then((res) => {
        if (!cancelled) {
          setDrivers(res.data);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load drivers:", err);
        setDrivers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSeasonId]);

  // Load run specification
  useEffect(() => {
    if (!selectedRunType) {
      setRunSpec(null);
      setMarkdownContent(null);
      return;
    }

    let cancelled = false;
    setLoadingSpec(true);
    setMarkdownContent(null);

    api
      .get(`/run-specs/${selectedRunType}`)
      .then((res) => {
        if (!cancelled) {
          setRunSpec(res.data);
          
          // Load markdown if available
          if (res.data.spec?.markdownPath) {
            setLoadingMarkdown(true);
            api
              .get(`/run-specs/${selectedRunType}/markdown`)
              .then((markdownRes) => {
                if (!cancelled) {
                  const content = markdownRes.data?.content;
                  if (content && typeof content === 'string' && content.trim().length > 0) {
                    setMarkdownContent(content);
                  } else {
                    setMarkdownContent(null);
                  }
                }
              })
              .catch((err) => {
                if (!cancelled) {
                  console.error("Failed to load markdown:", err);
                  // Markdown failed to load, will show message
                  setMarkdownContent(null);
                }
              })
              .finally(() => {
                if (!cancelled) {
                  setLoadingMarkdown(false);
                }
              });
          } else {
            console.log(`[RunLibrary] No markdown path for run type: ${selectedRunType}`);
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load run spec:", err);
        setRunSpec(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSpec(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRunType]);

  // Load run diagnostics (ALL-TIME, not season-filtered)
  useEffect(() => {
    if (!selectedRunType) {
      setRunDiagnostic(null);
      return;
    }

    let cancelled = false;
    setLoadingPerformance(true);

    api
      .get(`/analytics/run-diagnostics?runTypeCode=${selectedRunType}`)
      .then((res) => {
        if (!cancelled) {
          setRunDiagnostic(res.data);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load run diagnostics:", err);
        setRunDiagnostic(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPerformance(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRunType]);


  // Derive procedural summary from spec
  const proceduralSummary = useMemo(() => {
    if (!runSpec?.spec?.jsonSpec) return null;
    const spec = runSpec.spec.jsonSpec;
    const counts: Record<string, number> = {};

    if (Array.isArray(spec.steps)) counts.steps = spec.steps.length;
    if (Array.isArray(spec.criticalPath)) counts.criticalPath = spec.criticalPath.length;
    if (Array.isArray(spec.ruleGates)) counts.ruleGates = spec.ruleGates.length;
    if (spec.roles && typeof spec.roles === "object") {
      counts.roles = Object.keys(spec.roles).length;
    }
    if (Array.isArray(spec.phases)) counts.phases = spec.phases.length;
    if (spec.procedure?.phases && Array.isArray(spec.procedure.phases)) {
      counts.procedurePhases = spec.procedure.phases.length;
    }

    return Object.keys(counts).length > 0 ? counts : null;
  }, [runSpec]);

  // Calculate robust performance metrics (must be before early returns)
  const runTypeDriver = selectedRunType ? driverByRunTypeCode.get(selectedRunType) : undefined;
  const runCleanTimes = runDiagnostic?.dataPoints.map((dp) => dp.cleanTime) || [];
  const runBest = runCleanTimes.length > 0 ? Math.min(...runCleanTimes) : null;
  const runWorst = runCleanTimes.length > 0 ? Math.max(...runCleanTimes) : null;
  const runMedian = median(runCleanTimes);
  const runIQR = iqr(runCleanTimes);
  const latestRun = runDiagnostic?.dataPoints[runDiagnostic.dataPoints.length - 1];
  const latestCleanTime = latestRun?.cleanTime || null;
  const latestPenaltySeconds = latestRun?.penaltySeconds || 0;

  // Recoverable time estimate
  const recoverableSeconds = latestPenaltySeconds + (runIQR ? 0.5 * runIQR : 0);

  // What changed recently? (last 3 runs) - MUST be before early returns
  const recentInsights = useMemo(() => {
    if (!runDiagnostic || runDiagnostic.dataPoints.length < 3) return null;
    const last3 = runDiagnostic.dataPoints.slice(-3);
    const last3CleanTimes = last3.map((dp) => dp.cleanTime);
    const last3Median = median(last3CleanTimes);
    const prev3 = runDiagnostic.dataPoints.slice(-6, -3);
    if (prev3.length < 3) return null;

    const prev3CleanTimes = prev3.map((dp) => dp.cleanTime);
    const prev3Median = median(prev3CleanTimes);

    if (last3Median === null || prev3Median === null) return null;

    const medianDelta = last3Median - prev3Median;
    const latestPenalties = last3.map((dp) => dp.penaltySeconds);
    const totalRecentPenalties = latestPenalties.reduce((sum, p) => sum + p, 0);
    const consistencyIQR = iqr(last3CleanTimes);

    return {
      trend: medianDelta < 0 ? "improving" : medianDelta > 0 ? "declining" : "mixed",
      medianDelta: Math.abs(medianDelta),
      totalRecentPenalties,
      consistencyIQR,
    };
  }, [runDiagnostic]);

  // Selected season info
  const selectedSeason = selectedSeasonId
    ? seasons.find((s) => s.id === selectedSeasonId)
    : null;

  if (loading && runTypes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading diagnostics cockpit...</p>
        </div>
      </div>
    );
  }

  if (error && runTypes.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-800 font-semibold mb-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Banner - Show if there's an error but page can still render */}
      {error && runTypes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="ml-4 text-sm text-red-600 hover:text-red-800 underline"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Run Diagnostics Cockpit</h1>
          <p className="text-gray-600 mt-1">
            Procedural analysis, performance drivers, and recoverable time estimates
          </p>
        </div>
        {seasons.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Season Scope
            </label>
            <select
              value={selectedSeasonId || ""}
              onChange={(e) => setSelectedSeasonId(e.target.value || null)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
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

      {/* Data Scope Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <span className="font-medium text-blue-900">Season:</span>{" "}
            <span className="text-blue-700">
              {selectedSeason ? `${selectedSeason.name} (${selectedSeason.year})` : "All seasons"}
            </span>
          </div>
          <div>
            <span className="font-medium text-blue-900">Run Diagnostics:</span>{" "}
            <span className="text-blue-700">All-time</span>
            <span className="text-blue-600 text-xs ml-1">(season filter not yet supported)</span>
          </div>
          <div>
            <span className="font-medium text-blue-900">Penalty Drivers:</span>{" "}
            <span className="text-blue-700">
              {selectedSeasonId ? "Season-filtered" : "All seasons"}
            </span>
          </div>
        </div>
      </div>

      {seasonsError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          ⚠️ {seasonsError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Run Types Sidebar */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Run Types</h2>
          <div className="space-y-2">
            {runTypes.map((rt) => {
              const driver = driverByRunTypeCode.get(rt.code);
              const hasPenalties = driver && driver.penaltyCount > 0;
              const runCount = runDiagnostic?.dataPoints.length || 0;
              const showData = selectedRunType === rt.code && runCount > 0;

              return (
                <button
                  key={rt.id}
                  onClick={() => setSelectedRunType(rt.code)}
                  className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
                    selectedRunType === rt.code
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {rt.code} - {rt.name}
                      </div>
                      {showData && (
                        <div className={`text-xs mt-0.5 ${
                          selectedRunType === rt.code ? "text-blue-100" : "text-gray-500"
                        }`}>
                          {runCount} run{runCount !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                    {hasPenalties && (
                      <span className={`text-xs px-2 py-1 rounded flex-shrink-0 ml-2 ${
                        selectedRunType === rt.code
                          ? "bg-blue-500 text-white"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {driver.penaltyCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-3 space-y-6">
          {selectedRunType ? (
            <>
              {/* Performance Benchmarks */}
              {loadingPerformance ? (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-blue-200">
                  <div className="flex items-center justify-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Loading performance data...</span>
                  </div>
                </div>
              ) : (runBest !== null || runTypeDriver) ? (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-blue-200">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Performance Benchmarks - {runSpec?.runType.name || runTypeByCode.get(selectedRunType)?.name}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    {runBest !== null && (
                      <div className="bg-white p-4 rounded-lg border border-emerald-200">
                        <p className="text-xs text-gray-500 mb-1">Best Clean Time</p>
                        <p className="text-2xl font-bold text-emerald-900">
                          {formatTime(runBest)}
                        </p>
                        <p className="text-xs text-emerald-600 mt-1">
                          {runCleanTimes.length} run{runCleanTimes.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    )}
                    {runMedian !== null && (
                      <div className="bg-white p-4 rounded-lg border border-blue-200">
                        <p className="text-xs text-gray-500 mb-1">Median Clean Time</p>
                        <p className="text-2xl font-bold text-blue-900">
                          {formatTime(runMedian)}
                        </p>
                        {latestCleanTime !== null && (
                          <p className={`text-xs mt-2 font-semibold ${
                            latestCleanTime <= runMedian ? "text-emerald-600" : "text-red-600"
                          }`}>
                            {latestCleanTime <= runMedian ? "↓" : "↑"}{" "}
                            {formatTime(Math.abs(latestCleanTime - runMedian))}{" "}
                            {latestCleanTime <= runMedian ? "faster" : "slower"} than median
                          </p>
                        )}
                      </div>
                    )}
                    {runIQR !== null && (
                      <div className="bg-white p-4 rounded-lg border border-purple-200">
                        <p className="text-xs text-gray-500 mb-1">Consistency (IQR)</p>
                        <p className="text-2xl font-bold text-purple-900">
                          {formatTime(runIQR)}
                        </p>
                        <p className="text-xs text-purple-600 mt-1">
                          P75 - P25 spread
                        </p>
                      </div>
                    )}
                    {runWorst !== null && (
                      <div className="bg-white p-4 rounded-lg border border-red-200">
                        <p className="text-xs text-gray-500 mb-1">Worst Clean Time</p>
                        <p className="text-2xl font-bold text-red-900">
                          {formatTime(runWorst)}
                        </p>
                        {runBest !== null && (
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTime(runWorst - runBest)} range
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Recoverable Time Estimate */}
                  {recoverableSeconds > 0 && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-lg p-4 mb-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-amber-900 mb-1">
                            Recoverable Time (est.)
                          </h3>
                          <p className="text-3xl font-bold text-amber-900">
                            {formatTime(recoverableSeconds)}
                          </p>
                          <p className="text-xs text-amber-700 mt-1">
                            Penalty load + ½ variability (IQR). Estimate only.
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-amber-200">
                        <p className="text-xs text-amber-800">
                          <strong>What this means:</strong> Reducing penalties and tightening consistency
                          (reducing IQR) is the fastest path to improvement. This estimate combines current
                          penalty load with half the performance variability as a realistic recovery target.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* What Changed Recently */}
                  {recentInsights && (
                    <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">What Changed Recently?</h3>
                      <ul className="space-y-1 text-sm text-gray-700">
                        <li>
                          Last 3 runs: <span className="font-semibold">{recentInsights.trend}</span>
                          {recentInsights.medianDelta > 0 && (
                            <span className="ml-1">
                              (median {recentInsights.trend === "improving" ? "down" : "up"} by {formatTime(recentInsights.medianDelta)})
                            </span>
                          )}
                        </li>
                        {recentInsights.totalRecentPenalties > 0 && (
                          <li>
                            Penalties in latest 3 runs: <span className="font-semibold text-red-600">
                              +{formatTime(recentInsights.totalRecentPenalties)}
                            </span>
                          </li>
                        )}
                        {recentInsights.consistencyIQR !== null && (
                          <li>
                            Consistency (IQR): <span className="font-semibold">{formatTime(recentInsights.consistencyIQR)}</span>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Performance Drivers (formerly Penalty Analysis) */}
                  {runTypeDriver && (
                    <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Performance Drivers</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Total Penalties</p>
                          <p className="text-lg font-bold text-gray-900">
                            {formatTime(runTypeDriver.totalPenaltySeconds)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {runTypeDriver.penaltyCount} occurrence{runTypeDriver.penaltyCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {runTypeDriver.taxonomyBreakdown.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-2">Top Issues</p>
                            <div className="space-y-1">
                              {runTypeDriver.taxonomyBreakdown.slice(0, 3).map((tax, idx) => {
                                const percentage = runTypeDriver.totalPenaltySeconds > 0
                                  ? ((tax.totalSeconds / runTypeDriver.totalPenaltySeconds) * 100).toFixed(1)
                                  : "0";
                                return (
                                  <div key={idx} className="flex justify-between items-center text-sm">
                                    <span className="text-gray-700">{tax.taxonomyCode}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500">{percentage}%</span>
                                      <span className="font-semibold text-red-600">
                                        {formatTime(tax.totalSeconds)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      {runTypeDriver.taxonomyBreakdown.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-sm text-gray-700 mb-2">
                            <strong>Most likely training focus:</strong>{" "}
                            <span className="font-semibold text-blue-700">
                              {runTypeDriver.taxonomyBreakdown[0].taxonomyCode}
                            </span>{" "}
                            (largest contributor)
                          </p>
                          <Link
                            to={`/app/penalties?focus=${runTypeDriver.taxonomyBreakdown[0].taxonomyCode}`}
                            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                          >
                            Open drills for {runTypeDriver.taxonomyBreakdown[0].taxonomyCode}
                          </Link>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <div className="flex gap-3">
                      <Link
                        to={`/app/analysis?mode=run&runType=${selectedRunType}`}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                      >
                        View Detailed Analysis
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                  <p className="text-gray-500 text-center py-4">
                    No performance data available for this run type.
                  </p>
                </div>
              )}

              {/* Procedural Summary & Run Specification */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">
                  {runSpec?.runType.name || runTypeByCode.get(selectedRunType)?.name} - Procedural Specification
                </h2>
                {loadingSpec ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Loading specification...</span>
                  </div>
                ) : runSpec?.spec ? (
                  <div className="space-y-4">
                    {/* Procedural Summary */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Procedural Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Run Type</p>
                          <p className="font-medium text-gray-900">
                            {runSpec.runType.code} – {runSpec.runType.name}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Spec Status</p>
                          <p className="font-medium text-emerald-600">Available</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Spec Complexity</p>
                          {proceduralSummary ? (
                            <div className="space-y-0.5">
                              {Object.entries(proceduralSummary).map(([key, value]) => (
                                <p key={key} className="font-medium text-gray-900">
                                  {key}: {value}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="font-medium text-gray-500 italic text-xs">
                              Not yet structured for summarisation
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Machine Truth</p>
                          <p className="font-medium text-blue-600">Can drive simulation</p>
                        </div>
                      </div>
                    </div>

                    {/* Specification Display - Markdown Only */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold">Specification</h3>
                      </div>
                      
                      <div className="bg-white rounded-md overflow-hidden border border-gray-200">
                        {loadingMarkdown ? (
                          <div className="p-8 text-center">
                            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
                            <p className="text-sm text-gray-600">Loading documentation...</p>
                          </div>
                        ) : markdownContent ? (
                          <div className="p-6 max-h-96 overflow-y-auto">
                            <div className="prose prose-sm max-w-none">
                              <ReactMarkdown
                                components={{
                                  h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-xl font-semibold mt-6 mb-3">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>,
                                  h4: ({ children }) => <h4 className="text-base font-semibold mt-3 mb-2">{children}</h4>,
                                  p: ({ children }) => <p className="mb-3 text-gray-700">{children}</p>,
                                  ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 ml-4">{children}</ol>,
                                  li: ({ children }) => <li className="mb-1">{children}</li>,
                                  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                                  hr: () => <hr className="my-4 border-gray-300" />,
                                  code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
                                }}
                              >
                                {markdownContent}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ) : runSpec.spec.markdownPath ? (
                          <div className="p-6 text-center text-gray-500">
                            <p className="mb-2">Documentation not available.</p>
                            <p className="text-sm">Path: {runSpec.spec.markdownPath}</p>
                            <p className="text-xs mt-2 text-gray-400">
                              Contact an administrator to add documentation for this run type.
                            </p>
                          </div>
                        ) : (
                          <div className="p-6 text-center text-gray-500">
                            <p className="mb-2">No documentation available for this run type.</p>
                            <p className="text-xs mt-2 text-gray-400">
                              Contact an administrator to add documentation.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No specification available for this run type.</p>
                    <p className="text-sm mt-2">
                      Specifications can be added via the database or API.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
              <p>Select a run type to view its diagnostic cockpit.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
