import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

export function RunLibraryPage() {
  const [runTypes, setRunTypes] = useState<RunType[]>([]);
  const [selectedRunType, setSelectedRunType] = useState<string>("");
  const [runSpec, setRunSpec] = useState<RunSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [runDiagnostic, setRunDiagnostic] = useState<RunDiagnostic | null>(null);
  const [drivers, setDrivers] = useState<DriverAnalysis[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);

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
        if (seasonsData.length > 0 && !selectedSeasonId) {
          const latestSeason = [...seasonsData].sort((a, b) => b.year - a.year)[0];
          setSelectedSeasonId(latestSeason.id);
        }
      }),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const seasonParam = selectedSeasonId ? `?seasonId=${selectedSeasonId}` : "";
    api
      .get(`/analytics/drivers${seasonParam}`)
      .then((res) => setDrivers(res.data))
      .catch((err) => {
        console.error("Failed to load drivers:", err);
        setDrivers([]);
      });
  }, [selectedSeasonId]);

  useEffect(() => {
    if (selectedRunType) {
      Promise.all([
        api.get(`/run-specs/${selectedRunType}`).then((res) => setRunSpec(res.data)).catch(() => setRunSpec(null)),
      ]).catch(console.error);
    }
  }, [selectedRunType]);

  useEffect(() => {
    if (selectedRunType) {
      setLoadingPerformance(true);
      // Note: run-diagnostics doesn't support seasonId filter directly
      // We'll load all data and filter client-side if needed, or use competition-trends
      api
        .get(`/analytics/run-diagnostics?runTypeCode=${selectedRunType}`)
        .then((res) => {
          let diagnostic = res.data;
          // Filter by season if selected (client-side filtering)
          if (selectedSeasonId && diagnostic?.dataPoints) {
            // We'd need competition data to filter by season, so for now show all
            // In a real implementation, you'd want to add seasonId support to the API
          }
          setRunDiagnostic(diagnostic);
        })
        .catch((err) => {
          console.error("Failed to load run diagnostics:", err);
          setRunDiagnostic(null);
        })
        .finally(() => setLoadingPerformance(false));
    }
  }, [selectedRunType, selectedSeasonId]);

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  // Calculate performance metrics for selected run type
  const runTypeDriver = drivers.find((d) => d.runTypeCode === selectedRunType);
  const runCleanTimes = runDiagnostic?.dataPoints.map((dp) => dp.cleanTime) || [];
  const runBest = runCleanTimes.length > 0 ? Math.min(...runCleanTimes) : null;
  const runWorst = runCleanTimes.length > 0 ? Math.max(...runCleanTimes) : null;
  const runAverage = runCleanTimes.length > 0
    ? runCleanTimes.reduce((sum, t) => sum + t, 0) / runCleanTimes.length
    : null;
  const latestRun = runDiagnostic?.dataPoints[runDiagnostic.dataPoints.length - 1];
  const latestCleanTime = latestRun?.cleanTime || null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Run Library</h1>
          <p className="text-gray-600 mt-1">View run specifications, procedures, and performance benchmarks</p>
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Run Types</h2>
          <div className="space-y-2">
            {runTypes.map((rt) => {
              const driver = drivers.find((d) => d.runTypeCode === rt.code);
              const hasData = driver && driver.penaltyCount > 0;
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
                    <span className="font-medium">
                      {rt.code} - {rt.name}
                    </span>
                    {hasData && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        selectedRunType === rt.code
                          ? "bg-blue-500 text-white"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {driver.penaltyCount} penalty{driver.penaltyCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="md:col-span-3 space-y-6">
          {selectedRunType && (
            <>
              {/* Performance Benchmarks */}
              {!loadingPerformance && (runBest !== null || runTypeDriver) && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border border-blue-200">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Performance Benchmarks - {runSpec?.runType.name || runTypes.find((rt) => rt.code === selectedRunType)?.name}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {runBest !== null && (
                      <div className="bg-white p-4 rounded-lg border border-emerald-200">
                        <p className="text-xs text-gray-500 mb-1">Best Clean Time</p>
                        <p className="text-2xl font-bold text-emerald-900">
                          {formatTime(runBest)}
                        </p>
                        <p className="text-xs text-emerald-600 mt-1">
                          {runCleanTimes.length} run{runCleanTimes.length !== 1 ? "s" : ""} recorded
                        </p>
                      </div>
                    )}
                    {runAverage !== null && (
                      <div className="bg-white p-4 rounded-lg border border-blue-200">
                        <p className="text-xs text-gray-500 mb-1">Average Clean Time</p>
                        <p className="text-2xl font-bold text-blue-900">
                          {formatTime(runAverage)}
                        </p>
                        {latestCleanTime !== null && (
                          <p className={`text-xs mt-2 font-semibold ${
                            latestCleanTime <= runAverage ? "text-emerald-600" : "text-red-600"
                          }`}>
                            {latestCleanTime <= runAverage
                              ? `${formatTime(runAverage - latestCleanTime)} faster than avg`
                              : `${formatTime(latestCleanTime - runAverage)} slower than avg`}
                          </p>
                        )}
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

                  {/* Penalty Analysis */}
                  {runTypeDriver && (
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Penalty Analysis</h3>
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
                              {runTypeDriver.taxonomyBreakdown.slice(0, 3).map((tax, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                  <span className="text-gray-700">{tax.taxonomyCode}</span>
                                  <span className="font-semibold text-red-600">
                                    {formatTime(tax.totalSeconds)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <div className="flex gap-3">
                      <Link
                        to={`/analysis?mode=run&runType=${selectedRunType}`}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                      >
                        View Detailed Analysis
                      </Link>
                      {runTypeDriver && runTypeDriver.taxonomyBreakdown.length > 0 && (
                        <Link
                          to="/penalties"
                          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                        >
                          Fix Top Issue ({runTypeDriver.taxonomyBreakdown[0].taxonomyCode})
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Run Specification */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">
                  {runSpec?.runType.name || runTypes.find((rt) => rt.code === selectedRunType)?.name} - Specification
                </h2>
                {runSpec?.spec ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Specification (JSON)</h3>
                      <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-sm">
                        {JSON.stringify(runSpec.spec.jsonSpec, null, 2)}
                      </pre>
                    </div>
                    {runSpec.spec.markdownPath && (
                      <div>
                        <p className="text-sm text-gray-500">
                          Markdown documentation: {runSpec.spec.markdownPath}
                        </p>
                      </div>
                    )}
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

              {/* Performance History Summary */}
              {runDiagnostic && runDiagnostic.dataPoints.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold mb-4">Performance History</h2>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Total Runs Recorded</span>
                      <span className="font-semibold text-gray-900">{runDiagnostic.dataPoints.length}</span>
                    </div>
                    {latestRun && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Latest Run</span>
                        <span className="font-semibold text-gray-900">
                          {formatTime(latestRun.cleanTime)}
                          {latestRun.penaltySeconds > 0 && (
                            <span className="text-red-600 ml-2">
                              (+{formatTime(latestRun.penaltySeconds)} penalty)
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {runBest !== null && runWorst !== null && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Performance Range</span>
                        <span className="font-semibold text-gray-900">
                          {formatTime(runBest)} - {formatTime(runWorst)}
                        </span>
                      </div>
                    )}
                    {runAverage !== null && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Average Performance</span>
                        <span className="font-semibold text-gray-900">{formatTime(runAverage)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
