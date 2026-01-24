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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {bestPerformance !== null && (
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-lg shadow-lg border border-emerald-200">
              <h3 className="text-sm font-medium text-emerald-700">Best Performance</h3>
              <p className="text-3xl font-bold text-emerald-900 mt-2">
                {formatTime(bestPerformance)}
              </p>
              <p className="text-xs text-emerald-600 mt-1">Season minimum</p>
            </div>
          )}
          
          {seasonAverage !== null && (
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg shadow-lg border border-blue-200">
              <h3 className="text-sm font-medium text-blue-700">Season Average</h3>
              <p className="text-3xl font-bold text-blue-900 mt-2">
                {formatTime(seasonAverage)}
              </p>
              <p className="text-xs text-blue-600 mt-1">Mean median clean time</p>
            </div>
          )}
          
          {worstPerformance !== null && (
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-lg shadow-lg border border-red-200">
              <h3 className="text-sm font-medium text-red-700">Worst Performance</h3>
              <p className="text-3xl font-bold text-red-900 mt-2">
                {formatTime(worstPerformance)}
              </p>
              <p className="text-xs text-red-600 mt-1">Season maximum</p>
            </div>
          )}
          
          {performanceScore !== null && (
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-lg shadow-lg border border-indigo-200">
              <h3 className="text-sm font-medium text-indigo-700">Current Score</h3>
              <div className="mt-2">
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-indigo-900">
                    {Math.round(performanceScore)}
                  </span>
                  <span className="text-lg text-indigo-600 ml-2">/100</span>
                </div>
                <div className="mt-2 w-full bg-indigo-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      performanceScore >= 80
                        ? "bg-green-500"
                        : performanceScore >= 60
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${performanceScore}%` }}
                  />
                </div>
                <p className="text-xs text-indigo-600 mt-1">
                  Latest vs season range
                </p>
              </div>
            </div>
          )}
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
              <h2 className="text-lg font-semibold mb-4">Competition Trends</h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={competitionTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="competitionName"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis tickFormatter={(value) => formatTime(value)} />
                  <Tooltip
                    formatter={(value: number) => formatTime(value)}
                    labelFormatter={(label) => `Competition: ${label}`}
                  />
                  <Legend />
                  {seasonAverage !== null && (
                    <ReferenceLine
                      y={seasonAverage}
                      stroke="#6b7280"
                      strokeDasharray="5 5"
                      label={{ value: "Average", position: "right" }}
                    />
                  )}
                  {bestPerformance !== null && (
                    <ReferenceLine
                      y={bestPerformance}
                      stroke="#10b981"
                      strokeDasharray="3 3"
                      label={{ value: "Best", position: "right" }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="medianCleanTime"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Median Clean Time"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Penalty Load</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={competitionTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="competitionName" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatTime(value)} />
                    <Area
                      type="monotone"
                      dataKey="penaltyLoad"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Consistency (IQR)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={competitionTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="competitionName" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatTime(value)} />
                    <Line
                      type="monotone"
                      dataKey="consistencyIQR"
                      stroke="#10b981"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Competition Performance Summary */}
            {sortedTrends.length > 0 && latestCompetition && (
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg shadow-lg p-6 border border-indigo-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Performance Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Latest Competition</h4>
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">
                        {formatTime(latestCompetition.medianCleanTime)}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{latestCompetition.competitionName}</p>
                      {comparisonToAverage !== null && (
                        <p className={`text-xs mt-2 font-semibold ${
                          comparisonToAverage <= 0 ? "text-emerald-600" : "text-red-600"
                        }`}>
                          {comparisonToAverage <= 0
                            ? `✓ ${Math.abs(comparisonToAverage).toFixed(1)}% better than average`
                            : `${comparisonToAverage.toFixed(1)}% slower than average`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Trend Analysis</h4>
                    <div className="bg-white p-4 rounded-lg">
                      {sortedTrends.length >= 2 && (() => {
                        const recentTrend = sortedTrends[sortedTrends.length - 1].medianCleanTime - 
                                          sortedTrends[sortedTrends.length - 2].medianCleanTime;
                        return (
                          <>
                            <p className={`text-lg font-bold ${
                              recentTrend < 0 ? "text-emerald-600" : recentTrend === 0 ? "text-gray-600" : "text-red-600"
                            }`}>
                              {recentTrend < 0
                                ? `↓ Improving by ${formatTime(Math.abs(recentTrend))}`
                                : recentTrend === 0
                                ? "→ Stable"
                                : `↑ Declining by ${formatTime(recentTrend)}`}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              vs previous competition
                            </p>
                          </>
                        );
                      })()}
                      {sortedTrends.length < 2 && (
                        <p className="text-sm text-gray-500">Need more data for trend</p>
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
                  <h2 className="text-lg font-semibold mb-4">
                    {runDiagnostic.runTypeName} Trend
                  </h2>
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={runDiagnostic.dataPoints}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="competitionDate"
                        tickFormatter={(date) => formatDate(date)}
                      />
                      <YAxis tickFormatter={(value) => formatTime(value)} />
                      <Tooltip
                        formatter={(value: number) => formatTime(value)}
                        labelFormatter={(date) => formatDate(date)}
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
                          strokeWidth={2}
                          dot={false}
                          name="Rolling Median"
                        />
                      )}
                      {runDiagnostic.rollingIQR.length > 0 && (
                        <>
                          <Line
                            type="monotone"
                            dataKey="upper"
                            data={runDiagnostic.rollingIQR}
                            stroke="#10b981"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            dot={false}
                            name="IQR Upper"
                          />
                          <Line
                            type="monotone"
                            dataKey="lower"
                            data={runDiagnostic.rollingIQR}
                            stroke="#10b981"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            dot={false}
                            name="IQR Lower"
                          />
                        </>
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Run Type Benchmarks */}
                {runDiagnostic.dataPoints.length > 0 && (
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-lg p-6 border border-purple-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {runDiagnostic.runTypeName} Benchmarks
                    </h3>
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
                              <div className="bg-white p-4 rounded-lg">
                                <p className="text-xs text-gray-500 mb-1">Best Time</p>
                                <p className="text-2xl font-bold text-emerald-900">
                                  {formatTime(runBest)}
                                </p>
                                {latest !== null && (
                                  <p className={`text-xs mt-2 font-semibold ${
                                    latest <= runBest ? "text-emerald-600" : "text-gray-600"
                                  }`}>
                                    {latest <= runBest
                                      ? "✓ At best"
                                      : `${formatTime(latest - runBest)} from best`}
                                  </p>
                                )}
                              </div>
                            )}
                            {runAverage !== null && (
                              <div className="bg-white p-4 rounded-lg">
                                <p className="text-xs text-gray-500 mb-1">Average Time</p>
                                <p className="text-2xl font-bold text-blue-900">
                                  {formatTime(runAverage)}
                                </p>
                                {latest !== null && (
                                  <p className={`text-xs mt-2 font-semibold ${
                                    latest <= runAverage ? "text-emerald-600" : "text-red-600"
                                  }`}>
                                    {latest <= runAverage
                                      ? `${formatTime(runAverage - latest)} faster than avg`
                                      : `${formatTime(latest - runAverage)} slower than avg`}
                                  </p>
                                )}
                              </div>
                            )}
                            {runWorst !== null && (
                              <div className="bg-white p-4 rounded-lg">
                                <p className="text-xs text-gray-500 mb-1">Worst Time</p>
                                <p className="text-2xl font-bold text-red-900">
                                  {formatTime(runWorst)}
                                </p>
                                {latest !== null && (
                                  <p className={`text-xs mt-2 font-semibold ${
                                    latest < runWorst ? "text-emerald-600" : "text-gray-600"
                                  }`}>
                                    {latest < runWorst
                                      ? `${formatTime(runWorst - latest)} better than worst`
                                      : "At worst"}
                                  </p>
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
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Coaching Summary</h2>
          <div className="space-y-4">
            <div>
              <p className="text-gray-700">{coachingSummary.narrative}</p>
              <p className="text-sm text-gray-500 mt-2">
                Confidence:{" "}
                <span
                  className={`font-semibold ${
                    coachingSummary.confidence === "high"
                      ? "text-green-600"
                      : coachingSummary.confidence === "medium"
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {coachingSummary.confidence.toUpperCase()}
                </span>
              </p>
            </div>
            {coachingSummary.keyFindings.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Key Findings</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  {coachingSummary.keyFindings.map((finding, idx) => (
                    <li key={idx}>{finding}</li>
                  ))}
                </ul>
              </div>
            )}
            {coachingSummary.recommendedDrills.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Recommended Drills</h3>
                <ul className="space-y-2">
                  {coachingSummary.recommendedDrills.map((drill) => (
                    <li key={drill.drillId} className="text-gray-700">
                      <span className="font-medium">{drill.drillName}</span>: {drill.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {drivers.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Performance Drivers</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Run Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Penalty Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total Penalty Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Top Issues
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {drivers.slice(0, 5).map((driver) => (
                  <tr key={driver.runTypeCode}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      {driver.runTypeCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{driver.penaltyCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatTime(driver.totalPenaltySeconds)}
                    </td>
                    <td className="px-6 py-4">
                      {driver.taxonomyBreakdown
                        .slice(0, 3)
                        .map((t) => t.taxonomyCode)
                        .join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
