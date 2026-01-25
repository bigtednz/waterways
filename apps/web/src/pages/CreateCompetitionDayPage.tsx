import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

export function CreateCompetitionDayPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Default to today in NZ timezone (format: YYYY-MM-DD)
  const getTodayNZ = () => {
    const now = new Date();
    const nzDate = new Date(now.toLocaleString("en-US", { timeZone: "Pacific/Auckland" }));
    return nzDate.toISOString().split("T")[0];
  };

  const [formData, setFormData] = useState({
    date: getTodayNZ(),
    challengeName: "",
    locationName: "",
    trackName: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Convert date to ISO datetime at midnight NZ time
      const dateTime = new Date(`${formData.date}T00:00:00+13:00`).toISOString();

      const response = await api.post("/competition-days", {
        ...formData,
        date: dateTime,
        trackName: formData.trackName || undefined,
        notes: formData.notes || undefined,
      });

      // Redirect to queue builder
      navigate(`/app/competition-days/${response.data.id}`);
    } catch (err: any) {
      console.error("Failed to create competition day:", err);
      setError(err.response?.data?.error || err.message || "Failed to create competition day");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <button
          onClick={() => navigate("/app/competition-days")}
          className="text-blue-600 hover:underline mb-4 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Competition Days
        </button>
        <h1 className="text-3xl font-bold text-gray-900">New Competition Day</h1>
        <p className="text-gray-600 mt-2">Set up a competition day and build your run queue</p>
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

        <div>
          <label htmlFor="challengeName" className="block text-sm font-medium text-gray-700 mb-2">
            Challenge Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="challengeName"
            required
            value={formData.challengeName}
            onChange={(e) => setFormData({ ...formData, challengeName: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            placeholder="e.g., Spring Championship"
          />
        </div>

        <div>
          <label htmlFor="locationName" className="block text-sm font-medium text-gray-700 mb-2">
            Location <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="locationName"
            required
            value={formData.locationName}
            onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            placeholder="e.g., National Waterways Center"
          />
        </div>

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

        <div className="flex gap-4 justify-end pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate("/app/competition-days")}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !formData.challengeName || !formData.locationName}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating...
              </>
            ) : (
              <>
                Create & Build Queue
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
