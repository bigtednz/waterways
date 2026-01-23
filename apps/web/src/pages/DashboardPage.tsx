import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { formatDate } from "../lib/utils";

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

export function DashboardPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/seasons")
      .then((res) => setSeasons(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const recentCompetitions = seasons
    .flatMap((s) => s.competitions)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Season overview and recent competitions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Seasons</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">{seasons.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Competitions</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {seasons.reduce((sum, s) => sum + s.competitions.length, 0)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Active Season</h3>
          <p className="text-lg font-semibold text-gray-900 mt-2">
            {seasons[0]?.name || "None"}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Competitions</h2>
        </div>
        <div className="divide-y">
          {recentCompetitions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No competitions yet.{" "}
              <Link to="/competitions" className="text-blue-600 hover:underline">
                Create one
              </Link>
            </div>
          ) : (
            recentCompetitions.map((comp) => (
              <Link
                key={comp.id}
                to={`/competitions/${comp.id}`}
                className="block p-6 hover:bg-gray-50"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium text-gray-900">{comp.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDate(comp.date)} {comp.location && `• ${comp.location}`}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {(comp._count?.runResults ?? comp.runResults?.length ?? 0)} runs
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
