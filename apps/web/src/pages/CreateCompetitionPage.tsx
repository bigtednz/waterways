import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { formatTime } from "../lib/utils";

interface Season {
  id: string;
  name: string;
  year: number;
}

interface RunType {
  id: string;
  code: string;
  name: string;
}

interface RunData {
  runTypeCode: string;
  totalTimeSeconds: string;
  penaltySeconds: string;
  notes: string;
}

export function CreateCompetitionPage() {
  const navigate = useNavigate();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [runTypes, setRunTypes] = useState<RunType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [competitionData, setCompetitionData] = useState({
    seasonId: "",
    name: "",
    date: "",
    location: "",
    notes: "",
  });

  const [runs, setRuns] = useState<Record<string, RunData>>({});

  useEffect(() => {
    Promise.all([
      api.get("/seasons").then((res) => setSeasons(res.data)),
      api.get("/run-types").then((res) => {
        setRunTypes(res.data);
        // Initialize runs object with all run types
        const initialRuns: Record<string, RunData> = {};
        res.data.forEach((rt: RunType) => {
          initialRuns[rt.code] = {
            runTypeCode: rt.code,
            totalTimeSeconds: "",
            penaltySeconds: "0",
            notes: "",
          };
        });
        setRuns(initialRuns);
      }),
    ])
      .catch((err) => {
        console.error("Failed to load data:", err);
        setError("Failed to load seasons or run types");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCompetitionChange = (field: string, value: string) => {
    setCompetitionData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRunChange = (runTypeCode: string, field: keyof RunData, value: string) => {
    setRuns((prev) => ({
      ...prev,
      [runTypeCode]: {
        ...prev[runTypeCode],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      // Validate competition data
      if (!competitionData.seasonId || !competitionData.name || !competitionData.date) {
        throw new Error("Please fill in all required competition fields");
      }

      // Create competition
      const competitionResponse = await api.post("/competitions", {
        seasonId: competitionData.seasonId,
        name: competitionData.name,
        date: new Date(competitionData.date).toISOString(),
        location: competitionData.location || undefined,
        notes: competitionData.notes || undefined,
      });

      const competitionId = competitionResponse.data.id;

      // Filter runs that have time entered
      const runsToSubmit = Object.values(runs).filter(
        (run) => run.totalTimeSeconds && parseFloat(run.totalTimeSeconds) > 0
      );

      // Create runs if any were entered
      if (runsToSubmit.length > 0) {
        await api.post("/run-results/bulk", {
          competitionId,
          runs: runsToSubmit.map((run) => ({
            runTypeCode: run.runTypeCode,
            totalTimeSeconds: parseFloat(run.totalTimeSeconds),
            penaltySeconds: parseFloat(run.penaltySeconds) || 0,
            notes: run.notes || undefined,
          })),
        });
      }

      // Navigate to the new competition detail page
      navigate(`/app/competitions/${competitionId}`);
    } catch (err: any) {
      console.error("Failed to create competition:", err);
      setError(err.response?.data?.error || err.message || "Failed to create competition");
    } finally {
      setSubmitting(false);
    }
  };

  const filledRunsCount = Object.values(runs).filter(
    (run) => run.totalTimeSeconds && parseFloat(run.totalTimeSeconds) > 0
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <button
          onClick={() => navigate("/app/competitions")}
          className="text-blue-600 hover:underline mb-4 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Competitions
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Create New Competition</h1>
        <p className="text-gray-600 mt-2">Add a competition and enter run results in one go</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Competition Details Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Competition Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="seasonId" className="block text-sm font-medium text-gray-700 mb-2">
                Season <span className="text-red-500">*</span>
              </label>
              <select
                id="seasonId"
                required
                value={competitionData.seasonId}
                onChange={(e) => handleCompetitionChange("seasonId", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              >
                <option value="">Select a season</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name} ({season.year})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Competition Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                required
                value={competitionData.name}
                onChange={(e) => handleCompetitionChange("name", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                placeholder="e.g., Spring Championship"
              />
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                id="date"
                required
                value={competitionData.date}
                onChange={(e) => handleCompetitionChange("date", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                id="location"
                value={competitionData.location}
                onChange={(e) => handleCompetitionChange("location", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                placeholder="e.g., National Waterways Center"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                id="notes"
                value={competitionData.notes}
                onChange={(e) => handleCompetitionChange("notes", e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                placeholder="Optional notes about this competition"
              />
            </div>
          </div>
        </div>

        {/* Run Results Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Results
            </h2>
            <div className="text-sm text-gray-500">
              {filledRunsCount} of {runTypes.length} runs entered
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            Enter run times below. You can add all runs now or add them later from the competition detail page.
          </p>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Run Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Time (seconds)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Penalty (seconds)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {runTypes.map((rt) => {
                  const run = runs[rt.code] || {
                    runTypeCode: rt.code,
                    totalTimeSeconds: "",
                    penaltySeconds: "0",
                    notes: "",
                  };
                  const hasTime = run.totalTimeSeconds && parseFloat(run.totalTimeSeconds) > 0;
                  const cleanTime = hasTime
                    ? Math.max(0, parseFloat(run.totalTimeSeconds) - (parseFloat(run.penaltySeconds) || 0))
                    : null;

                  return (
                    <tr
                      key={rt.code}
                      className={`hover:bg-gray-50 transition-colors ${
                        hasTime ? "bg-green-50" : ""
                      }`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{rt.code}</span>
                          <span className="text-sm text-gray-600">{rt.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={run.totalTimeSeconds}
                          onChange={(e) => handleRunChange(rt.code, "totalTimeSeconds", e.target.value)}
                          className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                          placeholder="0.0"
                        />
                        {cleanTime !== null && (
                          <div className="text-xs text-gray-500 mt-1">
                            Clean: {formatTime(cleanTime)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={run.penaltySeconds}
                          onChange={(e) => handleRunChange(rt.code, "penaltySeconds", e.target.value)}
                          className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <input
                          type="text"
                          value={run.notes}
                          onChange={(e) => handleRunChange(rt.code, "notes", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                          placeholder="Optional notes"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filledRunsCount > 0 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>{filledRunsCount}</strong> run{filledRunsCount !== 1 ? "s" : ""} will be created with this competition.
              </p>
            </div>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 justify-end pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate("/app/competitions")}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !competitionData.seasonId || !competitionData.name || !competitionData.date}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Create Competition{filledRunsCount > 0 ? ` with ${filledRunsCount} Run${filledRunsCount !== 1 ? "s" : ""}` : ""}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
