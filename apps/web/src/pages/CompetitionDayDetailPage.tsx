/**
 * Competition Day Detail Page with Run Queue Builder
 * 
 * This page allows you to:
 * - View competition day details (date, challenge, location, track)
 * - Build a run queue by adding events in the actual order they will be run
 * - Quick-add common events (A1, A3, A5, A7, F9, F11, P13, P15, P17) or enter custom event codes
 * - Mark events as PLANNED, RUN, or SKIPPED
 * - Add reruns (additional attempts) for the same event
 * - Reorder events using Move Up/Down buttons
 * - Remove events from the queue
 * 
 * The queue sequence defines the actual order of events on competition day,
 * which may differ from the standard event order.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";

interface RunQueueItem {
  id: string;
  sequenceNo: number;
  eventCode: string;
  status: "PLANNED" | "RUN" | "SKIPPED";
  attemptNo: number;
  notes?: string;
}

interface CompetitionDay {
  id: string;
  date: string;
  challengeName: string;
  locationName: string;
  trackName?: string;
  notes?: string;
  queueItems: RunQueueItem[];
}

const COMMON_EVENTS = ["A1", "A3", "A5", "A7", "F9", "F11", "P13", "P15", "P17"];

export function CompetitionDayDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [competitionDay, setCompetitionDay] = useState<CompetitionDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customEventCode, setCustomEventCode] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      loadCompetitionDay();
    }
  }, [id]);

  const loadCompetitionDay = async () => {
    try {
      const response = await api.get(`/competition-days/${id}`);
      setCompetitionDay(response.data);
    } catch (err: any) {
      console.error("Failed to load competition day:", err);
      setError(err.response?.data?.error || "Failed to load competition day");
    } finally {
      setLoading(false);
    }
  };

  const addQueueItem = async (eventCode: string) => {
    if (!id) return;
    setSaving(true);
    try {
      await api.post(`/competition-days/${id}/queue`, {
        eventCode,
        status: "PLANNED",
        attemptNo: 1,
      });
      await loadCompetitionDay();
      setCustomEventCode("");
    } catch (err: any) {
      console.error("Failed to add queue item:", err);
      alert(err.response?.data?.error || "Failed to add event");
    } finally {
      setSaving(false);
    }
  };

  const updateQueueItem = async (itemId: string, updates: Partial<RunQueueItem>) => {
    setSaving(true);
    try {
      await api.put(`/competition-days/queue/${itemId}`, updates);
      await loadCompetitionDay();
    } catch (err: any) {
      console.error("Failed to update queue item:", err);
      alert(err.response?.data?.error || "Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  const deleteQueueItem = async (itemId: string) => {
    if (!window.confirm("Remove this item from the queue?")) return;
    setSaving(true);
    try {
      await api.delete(`/competition-days/queue/${itemId}`);
      await loadCompetitionDay();
    } catch (err: any) {
      console.error("Failed to delete queue item:", err);
      alert(err.response?.data?.error || "Failed to delete item");
    } finally {
      setSaving(false);
    }
  };

  const addRerun = async (item: RunQueueItem) => {
    if (!id) return;
    setSaving(true);
    try {
      await api.post(`/competition-days/${id}/queue`, {
        eventCode: item.eventCode,
        status: "PLANNED",
        attemptNo: item.attemptNo + 1,
        insertAfterSequenceNo: item.sequenceNo,
      });
      await loadCompetitionDay();
    } catch (err: any) {
      console.error("Failed to add rerun:", err);
      alert(err.response?.data?.error || "Failed to add rerun");
    } finally {
      setSaving(false);
    }
  };

  const moveItem = async (itemId: string, direction: "up" | "down") => {
    if (!competitionDay) return;
    const items = [...competitionDay.queueItems];
    const index = items.findIndex((item) => item.id === itemId);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    // Swap items
    [items[index], items[newIndex]] = [items[newIndex], items[index]];

    // Reorder
    setSaving(true);
    try {
      await api.put(`/competition-days/${id}/reorder`, {
        queueItemIds: items.map((item) => item.id),
      });
      await loadCompetitionDay();
    } catch (err: any) {
      console.error("Failed to reorder:", err);
      alert(err.response?.data?.error || "Failed to reorder items");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (error || !competitionDay) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error || "Competition day not found"}</p>
        <button
          onClick={() => navigate("/app/competition-days")}
          className="mt-4 text-blue-600 hover:underline"
        >
          Back to Competition Days
        </button>
      </div>
    );
  }

  const sortedQueue = [...competitionDay.queueItems].sort((a, b) => a.sequenceNo - b.sequenceNo);

  return (
    <div className="space-y-6">
      {/* Header */}
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
        <h1 className="text-3xl font-bold text-gray-900">{competitionDay.challengeName}</h1>
        <div className="mt-2 text-gray-600 space-y-1">
          <p>
            {new Date(competitionDay.date).toLocaleDateString("en-NZ", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p>{competitionDay.locationName}</p>
          {competitionDay.trackName && <p>Track: {competitionDay.trackName}</p>}
          {competitionDay.notes && <p className="text-sm italic">{competitionDay.notes}</p>}
        </div>
      </div>

      {/* Add Event Controls */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Add Event</h2>
        <div className="space-y-4">
          {/* Quick-add buttons */}
          <div>
            <p className="text-sm text-gray-600 mb-2">Quick Add:</p>
            <div className="flex flex-wrap gap-2">
              {COMMON_EVENTS.map((eventCode) => (
                <button
                  key={eventCode}
                  onClick={() => addQueueItem(eventCode)}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base touch-manipulation min-h-[44px]"
                >
                  {eventCode}
                </button>
              ))}
            </div>
          </div>

          {/* Custom event code */}
          <div>
            <p className="text-sm text-gray-600 mb-2">Custom Event Code:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={customEventCode}
                onChange={(e) => setCustomEventCode(e.target.value.toUpperCase())}
                placeholder="Enter event code (e.g., A2, F10)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                onKeyPress={(e) => {
                  if (e.key === "Enter" && customEventCode.trim()) {
                    e.preventDefault();
                    addQueueItem(customEventCode.trim());
                  }
                }}
              />
              <button
                onClick={() => customEventCode.trim() && addQueueItem(customEventCode.trim())}
                disabled={saving || !customEventCode.trim()}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base touch-manipulation min-h-[44px]"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Run Queue List */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Run Queue ({sortedQueue.length} item{sortedQueue.length !== 1 ? "s" : ""})
        </h2>

        {sortedQueue.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No events in queue yet. Add events above.</p>
        ) : (
          <div className="space-y-2">
            {sortedQueue.map((item, index) => (
              <div
                key={item.id}
                className={`p-4 border rounded-lg ${
                  item.status === "RUN"
                    ? "bg-green-50 border-green-200"
                    : item.status === "SKIPPED"
                    ? "bg-gray-100 border-gray-300"
                    : "bg-white border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <span className="text-lg font-bold text-gray-600 w-8">
                      {item.sequenceNo}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-gray-900">
                          {item.eventCode}
                        </span>
                        {item.attemptNo > 1 && (
                          <span className="text-sm text-gray-500">(Attempt {item.attemptNo})</span>
                        )}
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            item.status === "RUN"
                              ? "bg-green-100 text-green-800"
                              : item.status === "SKIPPED"
                              ? "bg-gray-200 text-gray-700"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      {item.notes && (
                        <p className="text-sm text-gray-600 mt-1">{item.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Move Up */}
                    <button
                      onClick={() => moveItem(item.id, "up")}
                      disabled={saving || index === 0}
                      className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
                      aria-label="Move up"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>

                    {/* Move Down */}
                    <button
                      onClick={() => moveItem(item.id, "down")}
                      disabled={saving || index === sortedQueue.length - 1}
                      className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
                      aria-label="Move down"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Status Toggle */}
                    {item.status === "PLANNED" ? (
                      <button
                        onClick={() => updateQueueItem(item.id, { status: "RUN" })}
                        disabled={saving}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 touch-manipulation min-h-[32px]"
                      >
                        Mark Run
                      </button>
                    ) : item.status === "RUN" ? (
                      <button
                        onClick={() => updateQueueItem(item.id, { status: "SKIPPED" })}
                        disabled={saving}
                        className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 disabled:opacity-50 touch-manipulation min-h-[32px]"
                      >
                        Mark Skipped
                      </button>
                    ) : (
                      <button
                        onClick={() => updateQueueItem(item.id, { status: "PLANNED" })}
                        disabled={saving}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 touch-manipulation min-h-[32px]"
                      >
                        Mark Planned
                      </button>
                    )}

                    {/* Add Rerun */}
                    <button
                      onClick={() => addRerun(item)}
                      disabled={saving}
                      className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50 touch-manipulation min-h-[32px]"
                    >
                      Rerun
                    </button>

                    {/* Remove */}
                    <button
                      onClick={() => deleteQueueItem(item.id)}
                      disabled={saving}
                      className="p-2 text-red-600 hover:text-red-800 disabled:opacity-50 touch-manipulation"
                      aria-label="Remove"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
