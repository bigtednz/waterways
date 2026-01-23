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

export function AnalysisPage() {
  const [mode, setMode] = useState<AnalysisMode>("competition");
  const [selectedRunType, setSelectedRunType] = useState<string>("");
  const [runTypes, setRunTypes] = useState<any[]>([]);
  const [competitionTrends, setCompetitionTrends] = useState<CompetitionTrend[]>([]);
  const [runDiagnostic, setRunDiagnostic] = useState<RunDiagnostic | null>(null);
  const [drivers, setDrivers] = useState<DriverAnalysis[]>([]);
  const [coachingSummary, setCoachingSummary] = useState<CoachingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/run-types")
      .then((res) => {
        setRunTypes(res.data);
        if (res.data.length > 0) {
          setSelectedRunType(res.data[0].code);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/analytics/competition-trends").then((res) => setCompetitionTrends(res.data)),
      api.get("/analytics/drivers").then((res) => setDrivers(res.data)),
      api.get("/analytics/coaching-summary").then((res) => setCoachingSummary(res.data)),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (mode === "run" && selectedRunType) {
      api
        .get(`/analytics/run-diagnostics?runTypeCode=${selectedRunType}`)
        .then((res) => setRunDiagnostic(res.data))
        .catch(console.error);
    }
  }, [mode, selectedRunType]);

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Performance Analysis</h1>
        <p className="text-gray-600 mt-1">Competition trends and run diagnostics</p>
      </div>

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
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => formatTime(value)}
                    labelFormatter={(label) => `Competition: ${label}`}
                  />
                  <Legend />
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
                      <YAxis />
                      <Tooltip
                        formatter={(value: number) => formatTime(value)}
                        labelFormatter={(date) => formatDate(date)}
                      />
                      <Legend />
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
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
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
