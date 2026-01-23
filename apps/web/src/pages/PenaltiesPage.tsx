import { useEffect, useState } from "react";
import api from "../lib/api";

interface PenaltyRule {
  id: string;
  ruleId: string;
  runTypeCode: string | null;
  ruleText: string;
  taxonomyCode: string;
  severity: string;
  outcomeType: string;
  outcomeSeconds: number | null;
  sourcePdfRef?: string;
  runType?: { code: string; name: string } | null;
}

export function PenaltiesPage() {
  const [penaltyRules, setPenaltyRules] = useState<PenaltyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRunType, setFilterRunType] = useState<string>("all");

  useEffect(() => {
    const url =
      filterRunType === "all"
        ? "/penalty-rules"
        : `/penalty-rules?runTypeCode=${filterRunType}`;
    api
      .get(url)
      .then((res) => setPenaltyRules(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filterRunType]);

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Penalty Rules</h1>
          <p className="text-gray-600 mt-1">
            Official penalty rules from the rulebook (verbatim text)
          </p>
        </div>
        <select
          value={filterRunType}
          onChange={(e) => setFilterRunType(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md"
        >
          <option value="all">All Run Types</option>
          <option value="A1">A1</option>
          <option value="A3">A3</option>
          <option value="A5">A5</option>
          <option value="A7">A7</option>
          <option value="F9">F9</option>
          <option value="F11">F11</option>
          <option value="P13">P13</option>
          <option value="P15">P15</option>
          <option value="P17">P17</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="divide-y divide-gray-200">
          {penaltyRules.map((rule) => (
            <div key={rule.id} className="p-6 hover:bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {rule.ruleId} - {rule.taxonomyCode}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {rule.runTypeCode ? (
                      <>
                        Applies to: <span className="font-medium">{rule.runTypeCode}</span>
                      </>
                    ) : (
                      <span className="font-medium">Applies to all run types</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      rule.severity === "critical"
                        ? "bg-red-100 text-red-800"
                        : rule.severity === "major"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {rule.severity}
                  </span>
                </div>
              </div>
              <p className="text-gray-700 mt-2">{rule.ruleText}</p>
              <div className="mt-4 flex gap-4 text-sm text-gray-500">
                <div>
                  <span className="font-medium">Outcome:</span> {rule.outcomeType}
                </div>
                {rule.outcomeSeconds !== null && (
                  <div>
                    <span className="font-medium">Penalty:</span> {rule.outcomeSeconds}s
                  </div>
                )}
                {rule.sourcePdfRef && (
                  <div>
                    <span className="font-medium">Reference:</span> {rule.sourcePdfRef}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {penaltyRules.length === 0 && (
          <div className="p-6 text-center text-gray-500">No penalty rules found</div>
        )}
      </div>
    </div>
  );
}
