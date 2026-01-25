import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import type { InterpretationResult } from "@waterways/shared";

interface PenaltyInterpreterProps {
  runTypeCode: string;
  initialNotes?: string;
  runResultId?: string;
  competitionId?: string;
  seasonId?: string;
}

export function PenaltyInterpreter({
  runTypeCode,
  initialNotes = "",
  runResultId,
  competitionId,
  seasonId,
}: PenaltyInterpreterProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    interpretation: InterpretationResult;
    runTypeName: string;
    specVersion: string;
  } | null>(null);

  const handleInterpret = async () => {
    if (!notes.trim()) {
      setError("Please enter penalty notes to interpret");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.post("/penalties/interpret", {
        runTypeCode,
        notes,
        runResultId,
        competitionId,
        seasonId,
      });

      setResult({
        interpretation: response.data.interpretation,
        runTypeName: response.data.runTypeName,
        specVersion: response.data.specVersion,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to interpret penalty notes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Penalty Notes Interpreter
      </h3>

      <div className="space-y-4">
        <div>
          <label htmlFor="penalty-notes" className="block text-sm font-medium text-gray-700 mb-2">
            Penalty Notes
          </label>
          <textarea
            id="penalty-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter penalty notes from the run (e.g., 'Orders overlap, valve opened early')"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base touch-manipulation min-h-[100px]"
            rows={4}
          />
        </div>

        <button
          onClick={handleInterpret}
          disabled={loading || !notes.trim()}
          className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
        >
          {loading ? "Interpreting..." : "Interpret Penalty Notes"}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Summary</h4>
              <p className="text-blue-800">{result.interpretation.summary}</p>
              <p className="text-sm text-blue-600 mt-2">
                Spec Version: {result.specVersion} | Run Type: {result.runTypeName}
              </p>
            </div>

            {result.interpretation.matches.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Detected Issues</h4>
                <div className="space-y-3">
                  {result.interpretation.matches.map((match, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                            {match.tag}
                          </span>
                          <span className="ml-2 text-sm text-gray-600">
                            Confidence: {(match.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {match.evidence.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-gray-600 mb-1">Evidence:</p>
                          <ul className="list-disc list-inside text-sm text-gray-700">
                            {match.evidence.slice(0, 3).map((ev, i) => (
                              <li key={i}>{ev}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {match.likelyRoles.length > 0 && (
                          <div>
                            <span className="font-medium text-gray-700">Roles: </span>
                            <span className="text-gray-600">{match.likelyRoles.join(", ")}</span>
                          </div>
                        )}
                        {match.likelyPhases.length > 0 && (
                          <div>
                            <span className="font-medium text-gray-700">Phases: </span>
                            <span className="text-gray-600">{match.likelyPhases.join(", ")}</span>
                          </div>
                        )}
                      </div>

                      {match.specAnchors.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-medium text-gray-700 mb-2">Spec References:</p>
                          <div className="space-y-1">
                            {match.specAnchors.slice(0, 3).map((anchor, i) => (
                              <div key={i} className="text-xs bg-white p-2 rounded border border-gray-200">
                                <span className="font-medium text-gray-700">{anchor.label}</span>
                                <span className="text-gray-500 mx-1">•</span>
                                <span className="text-gray-600">{anchor.kind}</span>
                                <p className="text-gray-700 mt-1 italic">{anchor.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.interpretation.recommendedFocus && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">What to Fix Next</h4>
                <p className="text-green-800 mb-3">
                  {result.interpretation.recommendedFocus.coachingMessage}
                </p>
                <Link
                  to={result.interpretation.recommendedFocus.runLibraryLink}
                  className="inline-block px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium touch-manipulation min-h-[44px] flex items-center"
                >
                  View Run Library →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
