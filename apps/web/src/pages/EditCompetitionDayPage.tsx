import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";

export function EditCompetitionDayPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [challengeSuggestions, setChallengeSuggestions] = useState<string[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showChallengeSuggestions, setShowChallengeSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);

  const [formData, setFormData] = useState({
    date: "",
    challengeName: "",
    locationName: "",
    trackName: "",
    notes: "",
  });
  const [teams, setTeams] = useState<string[]>([]);
  const [teamsInput, setTeamsInput] = useState("");

  // Load competition day data
  useEffect(() => {
    if (!id) return;

    Promise.all([
      api.get(`/competition-days/${id}`).then((res: any) => {
        const day = res.data;
        const date = new Date(day.date);
        const dateStr = date.toISOString().split("T")[0];
        
        setFormData({
          date: dateStr,
          challengeName: day.challengeName || "",
          locationName: day.locationName || "",
          trackName: day.trackName || "",
          notes: day.notes || "",
        });

        if (day.teams && Array.isArray(day.teams)) {
          setTeams(day.teams);
          setTeamsInput(day.teams.join(", "));
        }
        setShowOptionalFields(!!(day.trackName || day.notes));
      }),
      api.get("/competition-days").then((res: any) => {
        const days = res.data || [];
        const challenges = [...new Set(days.map((d: any) => d.challengeName).filter(Boolean))].slice(0, 10) as string[];
        const locations = [...new Set(days.map((d: any) => d.locationName).filter(Boolean))].slice(0, 10) as string[];
        setChallengeSuggestions(challenges);
        setLocationSuggestions(locations);
      }),
    ])
      .catch((err: any) => {
        console.error("Failed to load competition day:", err);
        setError(err.response?.data?.error || "Failed to load competition day");
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Parse comma-separated teams
  const handleTeamsInputChange = (value: string) => {
    setTeamsInput(value);
    if (value.includes(",") || value.includes("\n")) {
      const parsed = value
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      setTeams([...new Set(parsed)]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setError("");
    setSaving(true);

    try {
      // Convert date to ISO datetime at midnight NZ time
      const dateTime = new Date(`${formData.date}T00:00:00+13:00`).toISOString();

      await api.put(`/competition-days/${id}`, {
        ...formData,
        date: dateTime,
        trackName: formData.trackName || undefined,
        notes: formData.notes || undefined,
        teams: teams.length > 0 ? teams : undefined,
      });

      // Redirect back to detail page
      navigate(`/app/competition-days/${id}`);
    } catch (err: any) {
      console.error("Failed to update competition day:", err);
      setError(err.response?.data?.error || err.message || "Failed to update competition day");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading competition day...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <button
          onClick={() => navigate(`/app/competition-days/${id}`)}
          className="text-blue-600 hover:underline mb-4 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Competition Day
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Edit Competition Day</h1>
        <p className="text-gray-600 mt-2">Update competition day details</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6 space-y-6">
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
          />
        </div>

        <div className="relative">
          <label htmlFor="challengeName" className="block text-sm font-medium text-gray-700 mb-2">
            Challenge Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="challengeName"
            required
            value={formData.challengeName}
            onChange={(e) => {
              setFormData({ ...formData, challengeName: e.target.value });
              setShowChallengeSuggestions(true);
            }}
            onFocus={() => setShowChallengeSuggestions(true)}
            onBlur={() => setTimeout(() => setShowChallengeSuggestions(false), 200)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            placeholder="e.g., Spring Championship"
          />
          {showChallengeSuggestions && challengeSuggestions.length > 0 && formData.challengeName && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {challengeSuggestions
                .filter((c) => c.toLowerCase().includes(formData.challengeName.toLowerCase()))
                .slice(0, 5)
                .map((challenge, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, challengeName: challenge });
                      setShowChallengeSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm"
                  >
                    {challenge}
                  </button>
                ))}
            </div>
          )}
          {challengeSuggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-xs text-gray-500">Recent:</span>
              {challengeSuggestions.slice(0, 3).map((challenge, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setFormData({ ...formData, challengeName: challenge })}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                >
                  {challenge}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <label htmlFor="locationName" className="block text-sm font-medium text-gray-700 mb-2">
            Location <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="locationName"
            required
            value={formData.locationName}
            onChange={(e) => {
              setFormData({ ...formData, locationName: e.target.value });
              setShowLocationSuggestions(true);
            }}
            onFocus={() => setShowLocationSuggestions(true)}
            onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            placeholder="e.g., National Waterways Center"
          />
          {showLocationSuggestions && locationSuggestions.length > 0 && formData.locationName && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {locationSuggestions
                .filter((l) => l.toLowerCase().includes(formData.locationName.toLowerCase()))
                .slice(0, 5)
                .map((location, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, locationName: location });
                      setShowLocationSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm"
                  >
                    {location}
                  </button>
                ))}
            </div>
          )}
          {locationSuggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-xs text-gray-500">Recent:</span>
              {locationSuggestions.slice(0, 3).map((location, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setFormData({ ...formData, locationName: location })}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                >
                  {location}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowOptionalFields(!showOptionalFields)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showOptionalFields ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Optional Fields (Track, Notes)
          </button>
          {showOptionalFields && (
            <div className="space-y-4 pl-6 border-l-2 border-gray-200">
              <div>
                <label htmlFor="trackName" className="block text-sm font-medium text-gray-700 mb-2">
                  Track Name
                </label>
                <input
                  type="text"
                  id="trackName"
                  value={formData.trackName}
                  onChange={(e) => setFormData({ ...formData, trackName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  placeholder="e.g., Track A"
                />
              </div>
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  placeholder="Optional notes about this competition day"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Competing Teams <span className="text-gray-400 font-normal">(Optional)</span>
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Enter team names separated by commas or new lines. You can paste a list.
          </p>
          
          <textarea
            value={teamsInput}
            onChange={(e) => handleTeamsInputChange(e.target.value)}
            onBlur={() => {
              // Final parse on blur
              if (teamsInput.trim()) {
                const parsed = teamsInput
                  .split(/[,\n]/)
                  .map((t) => t.trim())
                  .filter((t) => t.length > 0);
                setTeams([...new Set(parsed)]);
              }
            }}
            placeholder="Team A, Team B, Team C&#10;or paste a list"
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
          />

          {teams.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-600 mb-2">
                {teams.length} team{teams.length !== 1 ? "s" : ""} added:
              </p>
              <div className="flex flex-wrap gap-2">
                {teams.map((team, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                  >
                    {team}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = teams.filter((_, i) => i !== index);
                        setTeams(updated);
                        setTeamsInput(updated.join(", "));
                      }}
                      className="text-purple-600 hover:text-purple-900 font-bold text-base leading-none"
                      title="Remove team"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4 justify-end pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate(`/app/competition-days/${id}`)}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !formData.challengeName || !formData.locationName}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                Save Changes
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
