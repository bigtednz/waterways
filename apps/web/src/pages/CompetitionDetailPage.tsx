import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { formatDate, formatTime } from "../lib/utils";

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
  season: { name: string };
  runResults: RunResult[];
}

export function CompetitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [runTypes, setRunTypes] = useState<any[]>([]);
  const [quickEntry, setQuickEntry] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!id) return;

    Promise.all([
      api.get(`/competitions/${id}`).then((res) => setCompetition(res.data)),
      api.get("/run-types").then((res) => setRunTypes(res.data)),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

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
    if (!id) return;

    const runs = Object.entries(quickEntry)
      .filter(([_, data]) => data.totalTimeSeconds)
      .map(([code, data]) => ({
        runTypeCode: code,
        totalTimeSeconds: parseFloat(data.totalTimeSeconds),
        penaltySeconds: parseFloat(data.penaltySeconds) || 0,
        notes: data.notes || undefined,
      }));

    try {
      await api.post("/run-results/bulk", {
        competitionId: id,
        runs,
      });
      window.location.reload();
    } catch (error) {
      console.error("Failed to save runs:", error);
      alert("Failed to save runs. Please try again.");
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
        <div className="p-6 border-t">
          <button
            onClick={handleBulkSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save All Runs
          </button>
        </div>
      </div>

      {competition.runResults.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Current Results</h2>
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
