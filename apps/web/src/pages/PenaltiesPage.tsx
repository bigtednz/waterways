import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { formatTime } from "../lib/utils";
import type { DriverAnalysis } from "@waterways/shared";

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

interface Season {
  id: string;
  name: string;
  year: number;
}

interface RunType {
  code: string;
  name: string;
}

export function PenaltiesPage() {
  const [penaltyRules, setPenaltyRules] = useState<PenaltyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRunType, setFilterRunType] = useState<string>("all");
  const [drivers, setDrivers] = useState<DriverAnalysis[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [runTypes, setRunTypes] = useState<RunType[]>([]);

  useEffect(() => {
    Promise.all([
      api.get("/run-types").then((res) => setRunTypes(res.data)),
      api.get("/seasons").then((res) => {
        const seasonsData = res.data as Season[];
        setSeasons(seasonsData);
        if (seasonsData.length > 0 && !selectedSeasonId) {
          const latestSeason = [...seasonsData].sort((a, b) => b.year - a.year)[0];
          setSelectedSeasonId(latestSeason.id);
        }
      }),
    ]).catch(console.error);
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
    setLoading(true);
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

  // Calculate penalty impact metrics
  const allTaxonomyBreakdowns = drivers.flatMap((d) => d.taxonomyBreakdown);
  const taxonomyMap = new Map<string, { totalSeconds: number; count: number; runTypes: Set<string> }>();
  
  allTaxonomyBreakdowns.forEach((tax) => {
    const existing = taxonomyMap.get(tax.taxonomyCode);
    if (existing) {
      existing.totalSeconds += tax.totalSeconds;
      existing.count += tax.count;
    } else {
      taxonomyMap.set(tax.taxonomyCode, {
        totalSeconds: tax.totalSeconds,
        count: tax.count,
        runTypes: new Set([drivers.find((d) => d.taxonomyBreakdown.includes(tax))?.runTypeCode || ""]),
      });
    }
  });

  const topIssues = Array.from(taxonomyMap.entries())
    .map(([code, data]) => ({ code, ...data }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
    .slice(0, 5);

  const totalPenaltyTime = drivers.reduce((sum, d) => sum + d.totalPenaltySeconds, 0);
  const totalPenaltyCount = drivers.reduce((sum, d) => sum + d.penaltyCount, 0);

  // Filter penalty rules by selected run type and match with impact data
  const penaltyRulesWithImpact = penaltyRules.map((rule) => {
    const impact = taxonomyMap.get(rule.taxonomyCode);
    return {
      ...rule,
      impact: impact
        ? {
            totalSeconds: impact.totalSeconds,
            count: impact.count,
          }
        : null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Penalty Rules & Impact Analysis</h1>
          <p className="text-gray-600 mt-1">
            Official penalty rules with performance impact metrics
          </p>
        </div>
        <div className="flex gap-3">
          {seasons.length > 0 && (
            <div className="bg-white rounded-lg shadow p-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Season
              </label>
              <select
                value={selectedSeasonId || ""}
                onChange={(e) => setSelectedSeasonId(e.target.value || null)}
                className="block w-full px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
          <div className="bg-white rounded-lg shadow p-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Run Type
            </label>
            <select
              value={filterRunType}
              onChange={(e) => setFilterRunType(e.target.value)}
              className="block w-full px-2 py-1 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Run Types</option>
              {runTypes.map((rt) => (
                <option key={rt.code} value={rt.code}>
                  {rt.code} - {rt.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Penalty Impact Summary */}
      {topIssues.length > 0 && (
        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg shadow-lg p-6 border border-red-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Penalty Impact Analysis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-red-200">
              <p className="text-xs text-gray-500 mb-1">Total Penalty Time</p>
              <p className="text-2xl font-bold text-red-900">
                {formatTime(totalPenaltyTime)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {totalPenaltyCount} occurrence{totalPenaltyCount !== 1 ? "s" : ""}
              </p>
            </div>
            {topIssues.slice(0, 3).map((issue, idx) => (
              <div key={idx} className="bg-white p-4 rounded-lg border border-orange-200">
                <p className="text-xs text-gray-500 mb-1">#{idx + 1} Issue</p>
                <p className="text-lg font-bold text-orange-900">{issue.code}</p>
                <p className="text-sm font-semibold text-red-600 mt-1">
                  {formatTime(issue.totalSeconds)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {issue.count} time{issue.count !== 1 ? "s" : ""}
                </p>
              </div>
            ))}
          </div>

          {/* Run Type Breakdown */}
          {drivers.length > 0 && (
            <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Penalties by Run Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {drivers
                  .filter((d) => d.penaltyCount > 0)
                  .sort((a, b) => b.totalPenaltySeconds - a.totalPenaltySeconds)
                  .slice(0, 6)
                  .map((driver) => (
                    <div key={driver.runTypeCode} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium text-gray-700">
                        {driver.runTypeCode}
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-red-600">
                          {formatTime(driver.totalPenaltySeconds)}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({driver.penaltyCount})
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-red-200">
            <Link
              to="/app/analysis"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View Detailed Analysis →
            </Link>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="divide-y divide-gray-200">
          {penaltyRulesWithImpact
            .sort((a, b) => {
              // Sort by impact (if available) or severity
              if (a.impact && b.impact) {
                return b.impact.totalSeconds - a.impact.totalSeconds;
              }
              if (a.impact) return -1;
              if (b.impact) return 1;
              // Sort by severity
              const severityOrder = { critical: 3, major: 2, minor: 1 };
              return (severityOrder[b.severity as keyof typeof severityOrder] || 0) -
                     (severityOrder[a.severity as keyof typeof severityOrder] || 0);
            })
            .map((rule) => {
              const isTopIssue = topIssues.some((issue) => issue.code === rule.taxonomyCode);
              return (
                <div
                  key={rule.id}
                  className={`p-6 hover:bg-gray-50 transition-colors ${
                    isTopIssue ? "bg-red-50 border-l-4 border-red-500" : ""
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {rule.ruleId} - {rule.taxonomyCode}
                        </h3>
                        {isTopIssue && (
                          <span className="px-2 py-1 text-xs bg-red-600 text-white rounded font-semibold">
                            Top Issue
                          </span>
                        )}
                      </div>
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
                    <div className="text-right flex flex-col gap-2">
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
                      {rule.impact && (
                        <div className="text-right">
                          <p className="text-xs font-semibold text-red-600">
                            {formatTime(rule.impact.totalSeconds)} lost
                          </p>
                          <p className="text-xs text-gray-500">
                            {rule.impact.count} time{rule.impact.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-700 mt-2">{rule.ruleText}</p>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
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
                    {rule.impact && (
                      <div className="ml-auto">
                        <span className="font-medium text-red-600">Impact:</span>{" "}
                        <span className="text-red-600">
                          {formatTime(rule.impact.totalSeconds)} across {rule.impact.count} occurrence
                          {rule.impact.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
        {penaltyRules.length === 0 && (
          <div className="p-6 text-center text-gray-500">No penalty rules found</div>
        )}
      </div>
    </div>
  );
}
