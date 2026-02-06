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
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import api from "../lib/api";
import { formatTime } from "../lib/utils";
import { auth } from "../lib/auth";
import { toast } from "../lib/toast";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { exportToCSV, exportToPDF, copyShareableLink } from "../lib/exportUtils";
import { onOnlineStatusChange, syncQueuedActions } from "../lib/offlineUtils";
import { getAllInsights, Insight } from "../lib/aiInsights";
import { analyzePacing } from "../lib/pacingAnalyzer";

interface RunQueueItem {
  id: string;
  sequenceNo: number;
  eventCode: string;
  status: "PLANNED" | "RUN" | "SKIPPED";
  attemptNo: number;
  notes?: string;
  totalTimeSeconds?: number | null;
  penaltySeconds?: number | null;
  splitTimes?: Record<string, number> | null;
  competitorTimes?: CompetitorTime[];
}

interface CompetitorTime {
  id: string;
  teamName: string;
  ran: boolean;
  totalTimeSeconds?: number | null;
  penaltySeconds?: number | null;
  splitTimes?: Record<string, number> | null;
  notes?: string;
}

interface RunSpecPhase {
  id?: string;
  name: string;
  phase?: number;
  timeLimit?: number;
}

interface CompetitionDay {
  id: string;
  date: string;
  challengeName: string;
  locationName: string;
  trackName?: string;
  notes?: string;
  teams?: string[];
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
  const [loadingStates, setLoadingStates] = useState({
    addingItem: false,
    updatingStatus: {} as Record<string, boolean>,
    savingTimes: {} as Record<string, boolean>,
    markingCompetitor: {} as Record<string, boolean>,
    deletingItem: {} as Record<string, boolean>,
    movingItem: {} as Record<string, boolean>,
    savingNotes: {} as Record<string, boolean>,
    addingCompetitor: {} as Record<string, boolean>,
    updatingCompetitor: {} as Record<string, boolean>,
    deletingCompetitor: {} as Record<string, boolean>,
  });
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [timeEntries, setTimeEntries] = useState<Record<string, { cleanTime: string; penalty: string; splitTimes: Record<string, string> }>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, { cleanTime?: string; penalty?: string; splitTimes?: Record<string, string> }>>({});
  const [runSpecs, setRunSpecs] = useState<Record<string, { phases: RunSpecPhase[] }>>({});
  const runSpecsRef = useRef(runSpecs);
  
  // Keep ref in sync with state
  useEffect(() => {
    runSpecsRef.current = runSpecs;
  }, [runSpecs]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [showCompetitorForm, setShowCompetitorForm] = useState<Record<string, boolean>>({});
  const [competitorForms, setCompetitorForms] = useState<Record<string, { teamName: string; cleanTime: string; penalty: string; splitTimes: Record<string, string>; notes?: string }>>({});
  const [editingCompetitorId, setEditingCompetitorId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: "danger" | "warning" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    type: "info",
  });
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingActions, setPendingActions] = useState(0);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [showInsights, setShowInsights] = useState(false);
  const [showVisualizations, setShowVisualizations] = useState(true);

  // Load competition day function - defined early so it can be used in useEffect
  const loadCompetitionDay = useCallback(async (skipSpecs = false) => {
    if (!id) return;
    try {
      const response = await api.get(`/competition-days/${id}`);
      const newData = response.data;
      
      setCompetitionDay(newData);
      // Initialize time entries from existing data
      const entries: Record<string, { cleanTime: string; penalty: string; splitTimes: Record<string, string> }> = {};
      if (newData.queueItems && Array.isArray(newData.queueItems)) {
        newData.queueItems.forEach((item: RunQueueItem) => {
          // Calculate time from stored total time and penalty
          const totalTime = item.totalTimeSeconds || 0;
          const penalty = item.penaltySeconds || 0;
          const time = roundToTwoDecimals(Math.max(0, totalTime - penalty));
          entries[item.id] = {
            cleanTime: time > 0 ? time.toFixed(2) : "",
            penalty: roundToTwoDecimals(penalty).toFixed(2),
            splitTimes: item.splitTimes ? Object.fromEntries(
              Object.entries(item.splitTimes).map(([k, v]) => [k, roundToTwoDecimals(v).toFixed(2)])
            ) : {},
          };
        });
      }
      setTimeEntries(entries);
      setValidationErrors({});
      
      // Load run specs for all event codes (only if not skipping and API is available)
      // Skip if offline to avoid repeated failed requests
      if (!skipSpecs && !isOffline) {
        const eventCodes = [...new Set((newData.queueItems || []).map((item: RunQueueItem) => item.eventCode))] as string[];
        const existingSpecCodes = Object.keys(runSpecsRef.current);
        const newEventCodes = eventCodes.filter(code => !existingSpecCodes.includes(code));
        
        // Only load specs for new event codes, or if this is the initial load (runSpecs is empty)
        if (newEventCodes.length > 0 || existingSpecCodes.length === 0) {
          const codesToLoad = existingSpecCodes.length === 0 ? eventCodes : newEventCodes;
          const specPromises = codesToLoad.map(async (code: string) => {
            try {
              const specRes = await api.get(`/run-specs/${code}`);
              return { code, spec: specRes.data };
            } catch (err: any) {
              // Silently fail for connection errors to avoid spam
              if (err.code !== "ERR_NETWORK" && err.code !== "ERR_CONNECTION_REFUSED") {
                console.warn(`Failed to load run spec for ${code}:`, err.message);
              }
              return { code, spec: null };
            }
          });
          const specResults = await Promise.all(specPromises);
          const newSpecs: Record<string, { phases: RunSpecPhase[] }> = { ...runSpecsRef.current };
          specResults.forEach(({ code, spec }) => {
            if (spec?.spec?.jsonSpec) {
              const jsonSpec = spec.spec.jsonSpec as any;
              const phases = jsonSpec.procedure?.phases || jsonSpec.phases || [];
              newSpecs[code] = { phases };
            }
          });
          setRunSpecs(newSpecs);
        }
      }
      
      // Generate AI insights (mock historical data for now)
      // In production, this would come from an API
      try {
        const mockHistoricalData = [
          { eventCode: "A1", avgTime: 120, bestTime: 110, avgPenalty: 5, completionRate: 0.95 },
          { eventCode: "A2", avgTime: 125, bestTime: 115, avgPenalty: 6, completionRate: 0.92 },
          { eventCode: "F9", avgTime: 130, bestTime: 120, avgPenalty: 8, completionRate: 0.88 },
        ];
        if (newData.queueItems && Array.isArray(newData.queueItems)) {
          const generatedInsights = getAllInsights(newData.queueItems, mockHistoricalData);
          setInsights(generatedInsights);
        } else {
          setInsights([]);
        }
      } catch (insightError) {
        console.error("Failed to generate insights:", insightError);
        setInsights([]);
      }
    } catch (err: any) {
      console.error("Failed to load competition day:", err);
      
      // Check if it's a connection error
      const isConnectionError = err.code === "ERR_NETWORK" || 
                                err.message?.includes("ERR_CONNECTION_REFUSED") ||
                                err.message?.includes("Network Error") ||
                                !err.response;
      
      let errorMessage: string;
      if (isConnectionError) {
        errorMessage = "Cannot connect to server. Please make sure the API server is running.";
      } else {
        errorMessage = err.response?.data?.error || err.message || "Failed to load competition day";
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
      // Set empty state on error to prevent further issues
      setInsights([]);
      setTimeEntries({});
      setValidationErrors({});
    } finally {
      setLoading(false);
    }
  }, [id, isOffline]);

  useEffect(() => {
    if (id) {
      loadCompetitionDay();
    }
  }, [id, loadCompetitionDay]);


  // Offline support: Listen for online/offline status
  useEffect(() => {
    const unsubscribe = onOnlineStatusChange((online) => {
      setIsOffline(!online);
      if (online && id) {
        // Sync queued actions when coming back online
        syncQueuedActions(id, async (action) => {
          // Replay the action via API
          switch (action.type) {
            case "add":
              await api.post(`/competition-days/${id}/queue`, action.data);
              break;
            case "update":
            case "status":
            case "times":
            case "notes":
              await api.put(`/competition-days/queue/${action.data.id}`, action.data);
              break;
            case "delete":
              await api.delete(`/competition-days/queue/${action.data.id}`);
              break;
            case "move":
              await api.put(`/competition-days/${id}/reorder`, action.data);
              break;
          }
        }).then(({ success, failed }) => {
          if (success > 0) {
            toast.success(`${success} action${success !== 1 ? "s" : ""} synced`);
            loadCompetitionDay();
          }
          if (failed > 0) {
            toast.error(`${failed} action${failed !== 1 ? "s" : ""} failed to sync`);
          }
        });
      }
    });

    return unsubscribe;
  }, [id, loadCompetitionDay]);

  // Check pending actions count
  useEffect(() => {
    if (!id || isOffline) return;
    const checkPending = async () => {
      try {
        const { getQueuedActions } = await import("../lib/offlineUtils");
        const actions = await getQueuedActions(id);
        setPendingActions(actions.length);
      } catch (err) {
        console.error("Failed to check pending actions:", err);
      }
    };
    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, [id, isOffline]);

  // Helper function to round to 2 decimal places
  const roundToTwoDecimals = (value: number): number => {
    return Math.round(value * 100) / 100;
  };

  // Validation functions
  const validateTimeEntry = useCallback((itemId: string, entry: { cleanTime: string; penalty: string; splitTimes: Record<string, string> }) => {
    const errors: { cleanTime?: string; penalty?: string; splitTimes?: Record<string, string> } = {};
    
    if (entry.cleanTime.trim()) {
      const time = parseFloat(entry.cleanTime);
      if (isNaN(time) || time <= 0) {
        errors.cleanTime = "Time must be a positive number";
      } else if (time >= 1000) {
        errors.cleanTime = "Time must be less than 1000 seconds";
      } else {
        // Check decimal places
        const decimalPlaces = (entry.cleanTime.split('.')[1] || '').length;
        if (decimalPlaces > 2) {
          errors.cleanTime = "Time must have at most 2 decimal places";
        }
      }
    }

    const penalty = parseFloat(entry.penalty) || 0;
    if (isNaN(penalty) || penalty < 0) {
      errors.penalty = "Penalty must be a non-negative number";
    } else if (entry.penalty.trim()) {
      // Check decimal places
      const decimalPlaces = (entry.penalty.split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        errors.penalty = "Penalty must have at most 2 decimal places";
      }
    }

    // Validate split times
    if (entry.splitTimes) {
      const splitErrors: Record<string, string> = {};
      let totalSplitTime = 0;
      for (const [phaseId, timeStr] of Object.entries(entry.splitTimes)) {
        if (timeStr && timeStr.trim()) {
          const time = parseFloat(timeStr);
          if (isNaN(time) || time <= 0) {
            splitErrors[phaseId] = "Must be a positive number";
          } else {
            // Check decimal places
            const decimalPlaces = (timeStr.split('.')[1] || '').length;
            if (decimalPlaces > 2) {
              splitErrors[phaseId] = "Must have at most 2 decimal places";
            } else {
              totalSplitTime += time;
            }
          }
        }
      }
      if (Object.keys(splitErrors).length > 0) {
        errors.splitTimes = splitErrors;
      }
      // Validate split times against time (not total time)
      if (entry.cleanTime.trim() && totalSplitTime > 0) {
        const time = parseFloat(entry.cleanTime);
        if (!isNaN(time) && totalSplitTime > time) {
          if (!errors.splitTimes) errors.splitTimes = {};
          errors.splitTimes._sum = "Sum of split times cannot exceed time";
        }
      }
    }

    setValidationErrors((prev) => ({
      ...prev,
      [itemId]: errors,
    }));

    return Object.keys(errors).length === 0;
  }, []);

  const addQueueItem = async (eventCode: string) => {
    if (!id || !competitionDay) return;
    setLoadingStates((prev) => ({ ...prev, addingItem: true }));
    
    // Optimistic update
    const optimisticItem: RunQueueItem = {
      id: `temp-${Date.now()}`,
      sequenceNo: competitionDay.queueItems.length + 1,
      eventCode,
      status: "PLANNED",
      attemptNo: 1,
    };
    const previousState = competitionDay;
    setCompetitionDay({
      ...competitionDay,
      queueItems: [...competitionDay.queueItems, optimisticItem],
    });
    
    try {
      await api.post(`/competition-days/${id}/queue`, {
        eventCode,
        status: "PLANNED",
        attemptNo: 1,
      });
      await loadCompetitionDay();
      setCustomEventCode("");
      toast.success(`Added ${eventCode} to queue`);
    } catch (err: any) {
      console.error("Failed to add queue item:", err);
      // Rollback
      setCompetitionDay(previousState);
      toast.error(err.response?.data?.error || "Failed to add event");
    } finally {
      setLoadingStates((prev) => ({ ...prev, addingItem: false }));
    }
  };

  const updateQueueItem = async (itemId: string, updates: Partial<RunQueueItem>) => {
    if (!competitionDay) return;
    
    const loadingKey = updates.status ? `status-${itemId}` : itemId;
    setLoadingStates((prev) => ({
      ...prev,
      updatingStatus: { ...prev.updatingStatus, [loadingKey]: true },
    }));
    
    // Optimistic update
    const previousState = competitionDay;
    setCompetitionDay({
      ...competitionDay,
      queueItems: competitionDay.queueItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    });
    
    try {
      await api.put(`/competition-days/queue/${itemId}`, updates);
      await loadCompetitionDay();
      if (updates.status) {
        toast.success(`Status updated to ${updates.status}`);
      }
    } catch (err: any) {
      console.error("Failed to update queue item:", err);
      // Rollback
      setCompetitionDay(previousState);
      toast.error(err.response?.data?.error || "Failed to update item");
    } finally {
      setLoadingStates((prev) => ({
        ...prev,
        updatingStatus: { ...prev.updatingStatus, [loadingKey]: false },
      }));
    }
  };

  const deleteQueueItem = async (itemId: string) => {
    if (!competitionDay) return;
    
    const item = competitionDay.queueItems.find((q) => q.id === itemId);
    setConfirmDialog({
      isOpen: true,
      title: "Remove Item",
      message: `Remove ${item?.eventCode || "this item"} from the queue?`,
      type: "danger",
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        setLoadingStates((prev) => ({
          ...prev,
          deletingItem: { ...prev.deletingItem, [itemId]: true },
        }));
        
        // Optimistic update
        const previousState = competitionDay;
        setCompetitionDay({
          ...competitionDay,
          queueItems: competitionDay.queueItems.filter((item) => item.id !== itemId),
        });
        
        try {
          await api.delete(`/competition-days/queue/${itemId}`);
          await loadCompetitionDay();
          toast.success("Item removed from queue");
        } catch (err: any) {
          console.error("Failed to delete queue item:", err);
          // Rollback
          setCompetitionDay(previousState);
          toast.error(err.response?.data?.error || "Failed to delete item");
        } finally {
          setLoadingStates((prev) => ({
            ...prev,
            deletingItem: { ...prev.deletingItem, [itemId]: false },
          }));
        }
      },
    });
  };

  const addRerun = async (item: RunQueueItem) => {
    if (!id || !competitionDay) return;
    setLoadingStates((prev) => ({ ...prev, addingItem: true }));
    
    // Optimistic update
    const optimisticItem: RunQueueItem = {
      id: `temp-${Date.now()}`,
      sequenceNo: item.sequenceNo + 1,
      eventCode: item.eventCode,
      status: "PLANNED",
      attemptNo: item.attemptNo + 1,
    };
    const previousState = competitionDay;
    const newItems = [...competitionDay.queueItems];
    const insertIndex = newItems.findIndex((q) => q.id === item.id) + 1;
    newItems.splice(insertIndex, 0, optimisticItem);
    // Renumber sequence
    newItems.forEach((q, idx) => {
      q.sequenceNo = idx + 1;
    });
    setCompetitionDay({
      ...competitionDay,
      queueItems: newItems,
    });
    
    try {
      await api.post(`/competition-days/${id}/queue`, {
        eventCode: item.eventCode,
        status: "PLANNED",
        attemptNo: item.attemptNo + 1,
        insertAfterSequenceNo: item.sequenceNo,
      });
      await loadCompetitionDay();
      toast.success(`Added rerun for ${item.eventCode}`);
    } catch (err: any) {
      console.error("Failed to add rerun:", err);
      // Rollback
      setCompetitionDay(previousState);
      toast.error(err.response?.data?.error || "Failed to add rerun");
    } finally {
      setLoadingStates((prev) => ({ ...prev, addingItem: false }));
    }
  };

  const moveItem = async (itemId: string, direction: "up" | "down") => {
    if (!competitionDay || !id) return;
    const items = [...competitionDay.queueItems];
    const index = items.findIndex((item) => item.id === itemId);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    // Optimistic update
    const previousState = competitionDay;
    const newItems = [...items];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    // Renumber sequence
    newItems.forEach((q, idx) => {
      q.sequenceNo = idx + 1;
    });
    setCompetitionDay({
      ...competitionDay,
      queueItems: newItems,
    });
    
    setLoadingStates((prev) => ({
      ...prev,
      movingItem: { ...prev.movingItem, [itemId]: true },
    }));

    try {
      await api.put(`/competition-days/${id}/reorder`, {
        queueItemIds: newItems.map((item) => item.id),
      });
      await loadCompetitionDay();
    } catch (err: any) {
      console.error("Failed to reorder:", err);
      // Rollback
      setCompetitionDay(previousState);
      toast.error(err.response?.data?.error || "Failed to reorder items");
    } finally {
      setLoadingStates((prev) => ({
        ...prev,
        movingItem: { ...prev.movingItem, [itemId]: false },
      }));
    }
  };

  const startEditingNotes = (item: RunQueueItem) => {
    setEditingNotesId(item.id);
    setNotesValue(item.notes || "");
  };

  const cancelEditingNotes = () => {
    setEditingNotesId(null);
    setNotesValue("");
  };

  const saveNotes = async (itemId: string) => {
    if (!competitionDay) return;
    setLoadingStates((prev) => ({
      ...prev,
      savingNotes: { ...prev.savingNotes, [itemId]: true },
    }));
    
    // Optimistic update
    const previousState = competitionDay;
    setCompetitionDay({
      ...competitionDay,
      queueItems: competitionDay.queueItems.map((item) =>
        item.id === itemId ? { ...item, notes: notesValue.trim() || undefined } : item
      ),
    });
    
    try {
      await updateQueueItem(itemId, { notes: notesValue.trim() || undefined });
      setEditingNotesId(null);
      setNotesValue("");
      toast.success("Notes saved");
    } catch (err: any) {
      console.error("Failed to save notes:", err);
      // Rollback
      setCompetitionDay(previousState);
      toast.error(err.response?.data?.error || "Failed to save notes");
    } finally {
      setLoadingStates((prev) => ({
        ...prev,
        savingNotes: { ...prev.savingNotes, [itemId]: false },
      }));
    }
  };

  const handleTimeChange = (itemId: string, field: "cleanTime" | "penalty", value: string) => {
    setTimeEntries((prev) => {
      // Allow typing freely - only restrict to valid decimal input (digits, one dot, optional minus)
      const sanitized = value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
      const newEntry = {
        ...prev[itemId] || { cleanTime: "", penalty: "0.00", splitTimes: {} },
        [field]: sanitized,
      };
      validateTimeEntry(itemId, newEntry);
      return {
        ...prev,
        [itemId]: newEntry,
      };
    });
  };

  const handleTimeBlur = (itemId: string, field: "cleanTime" | "penalty") => {
    setTimeEntries((prev) => {
      const entry = prev[itemId];
      if (!entry) return prev;
      const raw = entry[field];
      if (!raw || !raw.trim()) return prev;
      const num = parseFloat(raw);
      if (isNaN(num) || num < 0) return prev;
      const formatted = roundToTwoDecimals(num).toFixed(2);
      return {
        ...prev,
        [itemId]: { ...entry, [field]: formatted },
      };
    });
  };

  const handleSplitTimeChange = (itemId: string, phaseId: string, value: string) => {
    setTimeEntries((prev) => {
      const sanitized = value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
      const newEntry = {
        ...prev[itemId] || { cleanTime: "", penalty: "0.00", splitTimes: {} },
        splitTimes: {
          ...(prev[itemId]?.splitTimes || {}),
          [phaseId]: sanitized,
        },
      };
      validateTimeEntry(itemId, newEntry);
      return {
        ...prev,
        [itemId]: newEntry,
      };
    });
  };

  const handleSplitTimeBlur = (itemId: string, phaseId: string) => {
    setTimeEntries((prev) => {
      const entry = prev[itemId];
      if (!entry?.splitTimes) return prev;
      const raw = entry.splitTimes[phaseId];
      if (typeof raw !== "string" || !raw.trim()) return prev;
      const num = parseFloat(raw);
      if (isNaN(num) || num < 0) return prev;
      const formatted = roundToTwoDecimals(num).toFixed(2);
      return {
        ...prev,
        [itemId]: {
          ...entry,
          splitTimes: { ...entry.splitTimes, [phaseId]: formatted },
        },
      };
    });
  };

  const saveTimes = async (itemId: string) => {
    const entry = timeEntries[itemId];
    if (!entry || !competitionDay) return;

    // Validate before saving
    if (!validateTimeEntry(itemId, entry)) {
      toast.error("Please fix validation errors before saving");
      return;
    }

    setLoadingStates((prev) => ({
      ...prev,
      savingTimes: { ...prev.savingTimes, [itemId]: true },
    }));

    // Optimistic update
    // Calculate total time from clean time + penalty (penalties are ADDED to clean time)
    const previousState = competitionDay;
    const updates: any = {};
    const cleanTime = entry.cleanTime.trim() ? roundToTwoDecimals(parseFloat(entry.cleanTime)) : null;
    const penalty = roundToTwoDecimals(parseFloat(entry.penalty) || 0);
    
    if (cleanTime !== null && !isNaN(cleanTime) && cleanTime > 0) {
      // Total time = clean time + penalty (penalties are added, not subtracted)
      updates.totalTimeSeconds = roundToTwoDecimals(cleanTime + penalty);
    } else {
      updates.totalTimeSeconds = null;
    }

    updates.penaltySeconds = penalty;

    // Process split times
    const hasSplitTimeEntries = entry.splitTimes && Object.keys(entry.splitTimes).length > 0;
    if (hasSplitTimeEntries) {
      const splitTimes: Record<string, number> = {};
      let hasValidTimes = false;
      for (const [phaseId, timeStr] of Object.entries(entry.splitTimes)) {
        const timeValue = typeof timeStr === "string" ? timeStr : String(timeStr);
        if (timeValue && timeStr.trim()) {
          const time = parseFloat(timeValue);
          if (!isNaN(time) && time > 0) {
            splitTimes[phaseId] = time;
            hasValidTimes = true;
          }
        }
      }
      if (hasValidTimes) {
        updates.splitTimes = splitTimes;
      } else {
        updates.splitTimes = null;
      }
    }

    setCompetitionDay({
      ...competitionDay,
      queueItems: competitionDay.queueItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    });

    try {
      await api.put(`/competition-days/queue/${itemId}`, updates);
      await loadCompetitionDay();
      toast.success("Times saved successfully");
    } catch (err: any) {
      console.error("Failed to save times:", err);
      // Rollback
      setCompetitionDay(previousState);
      toast.error(err.response?.data?.error || "Failed to save times");
    } finally {
      setLoadingStates((prev) => ({
        ...prev,
        savingTimes: { ...prev.savingTimes, [itemId]: false },
      }));
    }
  };

  const markCompetitorRan = async (itemId: string, teamName: string, ran: boolean) => {
    if (!competitionDay) return;
    const loadingKey = `${itemId}-${teamName}`;
    setLoadingStates((prev) => ({
      ...prev,
      markingCompetitor: { ...prev.markingCompetitor, [loadingKey]: true },
    }));

    // Optimistic update
    const previousState = competitionDay;
    const item = competitionDay.queueItems.find((q) => q.id === itemId);
    const existing = item?.competitorTimes?.find((c) => c.teamName === teamName);
    
    if (item) {
      const updatedCompetitorTimes = existing
        ? item.competitorTimes?.map((c) => (c.teamName === teamName ? { ...c, ran } : c)) || []
        : [...(item.competitorTimes || []), { id: `temp-${Date.now()}`, teamName, ran } as CompetitorTime];
      
      setCompetitionDay({
        ...competitionDay,
        queueItems: competitionDay.queueItems.map((q) =>
          q.id === itemId ? { ...q, competitorTimes: updatedCompetitorTimes } : q
        ),
      });
    }

    try {
      if (existing) {
        await api.put(`/competition-days/competitors/${existing.id}`, { ran });
      } else {
        await api.post(`/competition-days/queue/${itemId}/competitors`, {
          teamName: teamName.trim(),
          ran,
        });
      }
      await loadCompetitionDay();
      toast.success(`${teamName} marked as ${ran ? "ran" : "didn't run"}`);
    } catch (err: any) {
      console.error("Failed to update competitor status:", err);
      // Rollback
      setCompetitionDay(previousState);
      toast.error(err.response?.data?.error || "Failed to update competitor status");
    } finally {
      setLoadingStates((prev) => ({
        ...prev,
        markingCompetitor: { ...prev.markingCompetitor, [loadingKey]: false },
      }));
    }
  };

  const addCompetitorTime = async (itemId: string) => {
    const form = competitorForms[itemId];
    if (!form || !form.teamName.trim() || !competitionDay) {
      toast.error("Team name is required");
      return;
    }

    setLoadingStates((prev) => ({
      ...prev,
      addingCompetitor: { ...prev.addingCompetitor, [itemId]: true },
    }));

    const time = form.cleanTime.trim() ? roundToTwoDecimals(parseFloat(form.cleanTime)) : undefined;
    const penalty = roundToTwoDecimals(parseFloat(form.penalty) || 0);
    
    if (time !== undefined && (isNaN(time) || time <= 0)) {
      toast.error("Time must be a positive number");
      setLoadingStates((prev) => ({
        ...prev,
        addingCompetitor: { ...prev.addingCompetitor, [itemId]: false },
      }));
      return;
    }

    const splitTimes: Record<string, number> | undefined = form.splitTimes && Object.keys(form.splitTimes).length > 0
      ? (() => {
          const result: Record<string, number> = {};
          for (const [k, v] of Object.entries(form.splitTimes)) {
            if (v && typeof v === "string" && v.trim()) {
              const num = roundToTwoDecimals(parseFloat(v));
              if (!isNaN(num) && num > 0) {
                result[k] = num;
              }
            }
          }
          return Object.keys(result).length > 0 ? result : undefined;
        })()
      : undefined;

    // Optimistic update
    const previousState = competitionDay;
    const item = competitionDay.queueItems.find((q) => q.id === itemId);
    const existing = item?.competitorTimes?.find((c) => c.teamName === form.teamName.trim());

    // Calculate total time from time + penalty (penalties are ADDED to time)
    const totalTime = time !== undefined ? roundToTwoDecimals(time + penalty) : undefined;
    
    const newCompetitor: CompetitorTime = {
      id: existing?.id || `temp-${Date.now()}`,
      teamName: form.teamName.trim(),
      ran: true,
      totalTimeSeconds: totalTime || null,
      penaltySeconds: penalty || null,
      splitTimes: splitTimes && Object.keys(splitTimes).length > 0 ? splitTimes : null,
      notes: form.notes?.trim() || undefined,
    };

    if (item) {
      const updatedCompetitorTimes = existing
        ? item.competitorTimes?.map((c) => (c.teamName === form.teamName.trim() ? newCompetitor : c)) || []
        : [...(item.competitorTimes || []), newCompetitor];
      
      setCompetitionDay({
        ...competitionDay,
        queueItems: competitionDay.queueItems.map((q) =>
          q.id === itemId ? { ...q, competitorTimes: updatedCompetitorTimes } : q
        ),
      });
    }

    try {
      if (existing) {
        await api.put(`/competition-days/competitors/${existing.id}`, {
          ran: true,
          totalTimeSeconds: totalTime || null,
          penaltySeconds: penalty || null,
          splitTimes: splitTimes && Object.keys(splitTimes).length > 0 ? splitTimes : null,
          notes: form.notes?.trim() || undefined,
        });
      } else {
        await api.post(`/competition-days/queue/${itemId}/competitors`, {
          teamName: form.teamName.trim(),
          ran: true,
          totalTimeSeconds: totalTime,
          penaltySeconds: penalty,
          splitTimes: splitTimes && Object.keys(splitTimes).length > 0 ? splitTimes : undefined,
          notes: form.notes?.trim() || undefined,
        });
      }

      setShowCompetitorForm((prev) => ({ ...prev, [itemId]: false }));
      setCompetitorForms((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      await loadCompetitionDay();
      toast.success(`Competitor time saved for ${form.teamName.trim()}`);
    } catch (err: any) {
      console.error("Failed to add competitor time:", err);
      // Rollback
      setCompetitionDay(previousState);
      toast.error(err.response?.data?.error || "Failed to add competitor time");
    } finally {
      setLoadingStates((prev) => ({
        ...prev,
        addingCompetitor: { ...prev.addingCompetitor, [itemId]: false },
      }));
    }
  };

  const startEditingCompetitor = (competitor: CompetitorTime, itemId: string) => {
    setEditingCompetitorId(competitor.id);
    // Calculate time from stored total time and penalty
    const totalTime = competitor.totalTimeSeconds || 0;
    const penalty = competitor.penaltySeconds || 0;
    const time = roundToTwoDecimals(Math.max(0, totalTime - penalty));
    setCompetitorForms((prev) => ({
      ...prev,
      [itemId]: {
        teamName: competitor.teamName,
        cleanTime: time > 0 ? time.toFixed(2) : "",
        penalty: roundToTwoDecimals(penalty).toFixed(2),
        splitTimes: competitor.splitTimes
          ? Object.fromEntries(
              Object.entries(competitor.splitTimes).map(([k, v]) => [k, v.toString()])
            )
          : {},
        notes: competitor.notes || "",
      },
    }));
    setShowCompetitorForm((prev) => ({ ...prev, [itemId]: true }));
  };

  const cancelEditingCompetitor = () => {
    setEditingCompetitorId(null);
  };

  const updateCompetitorTime = async (itemId: string, competitorId: string) => {
    const form = competitorForms[itemId];
    if (!form || !form.teamName.trim() || !competitionDay) {
      toast.error("Team name is required");
      return;
    }

    setLoadingStates((prev) => ({
      ...prev,
      updatingCompetitor: { ...prev.updatingCompetitor, [competitorId]: true },
    }));

    const time = form.cleanTime.trim() ? roundToTwoDecimals(parseFloat(form.cleanTime)) : null;
    const penalty = form.penalty.trim() ? roundToTwoDecimals(parseFloat(form.penalty) || 0) : null;

    if (time !== null && (isNaN(time) || time <= 0)) {
      toast.error("Time must be a positive number");
      setLoadingStates((prev) => ({
        ...prev,
        updatingCompetitor: { ...prev.updatingCompetitor, [competitorId]: false },
      }));
      return;
    }

    const splitTimes: Record<string, number> | null = form.splitTimes && Object.keys(form.splitTimes).length > 0
      ? (() => {
          const result: Record<string, number> = {};
          for (const [k, v] of Object.entries(form.splitTimes)) {
            if (v && typeof v === "string" && v.trim()) {
              const num = roundToTwoDecimals(parseFloat(v));
              if (!isNaN(num) && num > 0) {
                result[k] = num;
              }
            }
          }
          return Object.keys(result).length > 0 ? result : null;
        })()
      : null;

    // Calculate total time from time + penalty (penalties are ADDED to time)
    const totalTime = time !== null && penalty !== null ? roundToTwoDecimals(time + penalty) : null;
    
    // Optimistic update
    const previousState = competitionDay;
    const item = competitionDay.queueItems.find((q) => q.id === itemId);
    if (item) {
      const updatedCompetitorTimes = item.competitorTimes?.map((c) =>
        c.id === competitorId
          ? {
              ...c,
              teamName: form.teamName.trim(),
              ran: true,
              totalTimeSeconds: totalTime,
              penaltySeconds: penalty,
              splitTimes: splitTimes,
              notes: form.notes?.trim() || undefined,
            }
          : c
      ) || [];
      
      setCompetitionDay({
        ...competitionDay,
        queueItems: competitionDay.queueItems.map((q) =>
          q.id === itemId ? { ...q, competitorTimes: updatedCompetitorTimes } : q
        ),
      });
    }

    try {
      await api.put(`/competition-days/competitors/${competitorId}`, {
        teamName: form.teamName.trim(),
        ran: true,
        totalTimeSeconds: totalTime,
        penaltySeconds: penalty,
        splitTimes: splitTimes,
        notes: form.notes?.trim() || undefined,
      });

      setEditingCompetitorId(null);
      setShowCompetitorForm((prev) => ({ ...prev, [itemId]: false }));
      setCompetitorForms((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      await loadCompetitionDay();
      toast.success(`Competitor time updated for ${form.teamName.trim()}`);
    } catch (err: any) {
      console.error("Failed to update competitor time:", err);
      // Rollback
      setCompetitionDay(previousState);
      toast.error(err.response?.data?.error || "Failed to update competitor time");
    } finally {
      setLoadingStates((prev) => ({
        ...prev,
        updatingCompetitor: { ...prev.updatingCompetitor, [competitorId]: false },
      }));
    }
  };

  const deleteCompetitorTime = async (competitorId: string) => {
    if (!competitionDay) return;
    
    const competitor = competitionDay.queueItems
      .flatMap((q) => q.competitorTimes || [])
      .find((c) => c.id === competitorId);
    
    setConfirmDialog({
      isOpen: true,
      title: "Delete Competitor Time",
      message: `Delete competitor time for ${competitor?.teamName || "this competitor"}?`,
      type: "danger",
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        setLoadingStates((prev) => ({
          ...prev,
          deletingCompetitor: { ...prev.deletingCompetitor, [competitorId]: true },
        }));

        // Optimistic update
        const previousState = competitionDay;
        setCompetitionDay({
          ...competitionDay,
          queueItems: competitionDay.queueItems.map((q) => ({
            ...q,
            competitorTimes: q.competitorTimes?.filter((c) => c.id !== competitorId) || [],
          })),
        });

        try {
          await api.delete(`/competition-days/competitors/${competitorId}`);
          await loadCompetitionDay();
          toast.success("Competitor time deleted");
        } catch (err: any) {
          console.error("Failed to delete competitor time:", err);
          // Rollback
          setCompetitionDay(previousState);
          toast.error(err.response?.data?.error || "Failed to delete competitor time");
        } finally {
          setLoadingStates((prev) => ({
            ...prev,
            deletingCompetitor: { ...prev.deletingCompetitor, [competitorId]: false },
          }));
        }
      },
    });
  };

  const handleDeleteCompetitionDay = () => {
    if (!competitionDay || !id) return;
    
    setConfirmDialog({
      isOpen: true,
      title: "Delete Competition Day",
      message: `Are you sure you want to delete "${competitionDay.challengeName}"? This will permanently delete the competition day and all its queue items, times, and competitor data. This action cannot be undone.`,
      type: "danger",
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        setLoadingStates((prev) => ({ ...prev, deletingItem: { ...prev.deletingItem, competitionDay: true } }));
        
        try {
          await api.delete(`/competition-days/${id}`);
          toast.success("Competition day deleted successfully");
          navigate("/app/competition-days");
        } catch (err: any) {
          console.error("Failed to delete competition day:", err);
          toast.error(err.response?.data?.error || "Failed to delete competition day");
        } finally {
          setLoadingStates((prev) => {
            const next = { ...prev.deletingItem };
            delete next.competitionDay;
            return { ...prev, deletingItem: next };
          });
        }
      },
    });
  };

  // Bulk operations
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleSelectAll = useCallback(() => {
    if (!competitionDay) return;
    const queue = [...competitionDay.queueItems].sort((a, b) => a.sequenceNo - b.sequenceNo);
    if (selectedItems.size === queue.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(queue.map((item) => item.id)));
    }
  }, [competitionDay, selectedItems.size]);

  const bulkUpdateStatus = async (status: "RUN" | "SKIPPED" | "PLANNED") => {
    if (!competitionDay || selectedItems.size === 0) return;
    
    setBulkActionLoading(true);
    const selectedIds = Array.from(selectedItems);
    const previousState = competitionDay;

    // Optimistic update
    setCompetitionDay({
      ...competitionDay,
      queueItems: competitionDay.queueItems.map((item) =>
        selectedItems.has(item.id) ? { ...item, status } : item
      ),
    });

    try {
      await Promise.all(
        selectedIds.map((itemId) =>
          api.put(`/competition-days/queue/${itemId}`, { status })
        )
      );
      await loadCompetitionDay();
      setSelectedItems(new Set());
      toast.success(`${selectedIds.length} item${selectedIds.length !== 1 ? "s" : ""} marked as ${status}`);
    } catch (err: any) {
      console.error("Failed to bulk update status:", err);
      // Rollback
      setCompetitionDay(previousState);
      toast.error(err.response?.data?.error || "Failed to update items");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const bulkDelete = async () => {
    if (!competitionDay || selectedItems.size === 0) return;
    
    const selectedIds = Array.from(selectedItems);
    setConfirmDialog({
      isOpen: true,
      title: "Delete Selected Items",
      message: `Are you sure you want to delete ${selectedIds.length} item${selectedIds.length !== 1 ? "s" : ""}? This action cannot be undone.`,
      type: "danger",
      onConfirm: async () => {
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        setBulkActionLoading(true);
        const previousState = competitionDay;

        // Optimistic update
        setCompetitionDay({
          ...competitionDay,
          queueItems: competitionDay.queueItems.filter((item) => !selectedItems.has(item.id)),
        });

        try {
          await Promise.all(
            selectedIds.map((itemId) => api.delete(`/competition-days/queue/${itemId}`))
          );
          await loadCompetitionDay();
          setSelectedItems(new Set());
          toast.success(`${selectedIds.length} item${selectedIds.length !== 1 ? "s" : ""} deleted`);
        } catch (err: any) {
          console.error("Failed to bulk delete:", err);
          // Rollback
          setCompetitionDay(previousState);
          toast.error(err.response?.data?.error || "Failed to delete items");
        } finally {
          setBulkActionLoading(false);
        }
      },
    });
  };

  // All hooks must be called before any conditional returns
  // Calculate sorted queue
  const sortedQueue = useMemo(() => {
    if (!competitionDay) return [];
    return [...competitionDay.queueItems].sort((a, b) => a.sequenceNo - b.sequenceNo);
  }, [competitionDay]);

  // Calculate progress
  const progress = useMemo(() => {
    if (!competitionDay || sortedQueue.length === 0) return { completed: 0, total: 0, percentage: 0 };
    const completed = sortedQueue.filter((item) => item.status === "RUN").length;
    const total = sortedQueue.length;
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [competitionDay, sortedQueue]);

  // Prepare visualization data
  const visualizationData = useMemo(() => {
    if (!competitionDay || sortedQueue.length === 0) {
      return {
        timeDistribution: [],
        performanceOverTime: [],
        penaltyAnalysis: [],
        eventTypePerformance: [],
        teamComparison: [],
      };
    }

    // Get completed runs with times
    const completedRuns = sortedQueue.filter(
      (item) => item.status === "RUN" && item.totalTimeSeconds !== null && item.totalTimeSeconds !== undefined
    );

    // Time distribution for completed runs (enhanced with best/average)
    const timeDistribution = completedRuns.map((item) => {
      const totalTime = item.totalTimeSeconds || 0;
      const penalty = item.penaltySeconds || 0;
      const cleanTime = Math.max(0, totalTime - penalty); // Ensure clean time is never negative
      return {
        name: `${item.eventCode}${item.attemptNo > 1 ? ` (R${item.attemptNo})` : ""}`,
        time: totalTime,
        cleanTime,
        penalty,
        sequenceNo: item.sequenceNo,
        eventCode: item.eventCode,
      };
    }).sort((a, b) => a.sequenceNo - b.sequenceNo);

    // Calculate best and average for reference
    const cleanTimes = timeDistribution.map((d) => d.cleanTime);
    const bestCleanTime = cleanTimes.length > 0 ? Math.min(...cleanTimes) : 0;
    const avgCleanTime = cleanTimes.length > 0 
      ? cleanTimes.reduce((sum, t) => sum + t, 0) / cleanTimes.length 
      : 0;

    // Performance over time - shows if times degrade through the day (fatigue analysis)
    const performanceOverTime = completedRuns
      .map((item) => {
        const totalTime = item.totalTimeSeconds || 0;
        const penalty = item.penaltySeconds || 0;
        return {
          sequence: item.sequenceNo,
          event: item.eventCode,
          cleanTime: Math.max(0, totalTime - penalty), // Ensure clean time is never negative
          totalTime,
          penalty,
        };
      })
      .sort((a, b) => a.sequence - b.sequence);

    // Enhanced penalty analysis with percentages
    const runsWithPenalties = completedRuns.filter((item) => (item.penaltySeconds || 0) > 0);
    const penaltyAnalysis = runsWithPenalties.map((item) => {
      const totalTime = item.totalTimeSeconds!;
      const penalty = item.penaltySeconds || 0;
      // Cap penalty percentage at 100% to handle edge cases
      const penaltyPercentage = totalTime > 0 
        ? Math.min(100, Math.round((penalty / totalTime) * 100))
        : 0;
      return {
        name: `${item.eventCode}${item.attemptNo > 1 ? ` (R${item.attemptNo})` : ""}`,
        penalty: penalty,
        penaltyPercentage,
        totalTime: totalTime,
        eventCode: item.eventCode,
      };
    }).sort((a, b) => b.penaltyPercentage - a.penaltyPercentage); // Sort by impact

    // Event type performance (A vs F vs P)
    const eventTypeGroups = new Map<string, number[]>();
    completedRuns.forEach((item) => {
      const eventType = item.eventCode.charAt(0); // A, F, or P
      const totalTime = item.totalTimeSeconds || 0;
      const penalty = item.penaltySeconds || 0;
      const cleanTime = Math.max(0, totalTime - penalty); // Ensure clean time is never negative
      if (!eventTypeGroups.has(eventType)) {
        eventTypeGroups.set(eventType, []);
      }
      eventTypeGroups.get(eventType)!.push(cleanTime);
    });

    const eventTypePerformance = Array.from(eventTypeGroups.entries()).map(([type, times]) => {
      const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
      const best = Math.min(...times);
      const worst = Math.max(...times);
      return {
        type: type,
        average: Math.round(avg),
        best: best,
        worst: worst,
        count: times.length,
      };
    }).sort((a, b) => a.type.localeCompare(b.type));

    // Team/Competitor comparison (if multiple teams have times)
    const teamComparisonData: Array<{
      event: string;
      team: string;
      cleanTime: number;
      totalTime: number;
      penalty: number;
    }> = [];
    
    completedRuns.forEach((item) => {
      if (item.competitorTimes && item.competitorTimes.length > 1) {
        item.competitorTimes.forEach((competitor) => {
          if (competitor.ran && competitor.totalTimeSeconds) {
            const totalTime = competitor.totalTimeSeconds;
            const penalty = competitor.penaltySeconds || 0;
            teamComparisonData.push({
              event: `${item.eventCode}${item.attemptNo > 1 ? ` (R${item.attemptNo})` : ""}`,
              team: competitor.teamName,
              cleanTime: Math.max(0, totalTime - penalty), // Ensure clean time is never negative
              totalTime,
              penalty,
            });
          }
        });
      }
    });

    // Group team comparison by event for better visualization
    const teamComparisonByEvent = new Map<string, typeof teamComparisonData>();
    teamComparisonData.forEach((data) => {
      if (!teamComparisonByEvent.has(data.event)) {
        teamComparisonByEvent.set(data.event, []);
      }
      teamComparisonByEvent.get(data.event)!.push(data);
    });

    const teamComparison = Array.from(teamComparisonByEvent.entries())
      .map(([event, teams]) => {
        const bestTeam = teams.reduce((best, current) => 
          current.cleanTime < best.cleanTime ? current : best
        );
        return {
          event,
          teams: teams.map((t) => ({
            team: t.team,
            cleanTime: t.cleanTime,
            totalTime: t.totalTime,
            penalty: t.penalty,
            isBest: t.team === bestTeam.team,
          })),
        };
      })
      .filter((entry) => entry.teams.length > 1); // Only show if multiple teams

    // === ADVANCED ANALYTICS ===
    
    // 1. Predictive Completion Time
    const remainingRuns = sortedQueue.filter((item) => item.status === "PLANNED").length;
    const avgTimePerRun = completedRuns.length > 0
      ? completedRuns.reduce((sum, item) => sum + (item.totalTimeSeconds || 0), 0) / completedRuns.length
      : 0;
    const estimatedTimeRemaining = avgTimePerRun * remainingRuns;
    const estimatedCompletionTime = new Date(Date.now() + estimatedTimeRemaining * 1000);
    
    // Calculate confidence intervals (optimistic, realistic, pessimistic)
    // Use sample standard deviation (n-1) for better estimates with small samples
    const times = completedRuns.map((item) => item.totalTimeSeconds || 0);
    const stdDev = times.length > 1
      ? Math.sqrt(times.reduce((sum, t) => sum + Math.pow(t - avgTimePerRun, 2), 0) / (times.length - 1))
      : 0;
    const optimisticTime = Math.max(0, (avgTimePerRun - stdDev) * remainingRuns); // Ensure non-negative
    const pessimisticTime = (avgTimePerRun + stdDev) * remainingRuns;
    
    // 2. Anomaly Detection
    const anomalies = completedRuns
      .map((item) => {
        const totalTime = item.totalTimeSeconds || 0;
        const penalty = item.penaltySeconds || 0;
        const cleanTime = Math.max(0, totalTime - penalty); // Ensure clean time is never negative
        if (times.length < 2) return null;
        const mean = avgTimePerRun;
        // Use sample std dev for z-score calculation
        const sampleStdDev = times.length > 1
          ? Math.sqrt(times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / (times.length - 1))
          : 0;
        const zScore = sampleStdDev > 0 ? Math.abs((totalTime - mean) / sampleStdDev) : 0;
        return zScore > 2
          ? {
              event: `${item.eventCode}${item.attemptNo > 1 ? ` (R${item.attemptNo})` : ""}`,
              sequence: item.sequenceNo,
              time: totalTime,
              cleanTime,
              zScore: zScore.toFixed(2),
              type: totalTime > mean ? "slow" : "fast",
            }
          : null;
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
    
    // 3. Split Time Analysis (if split times exist)
    const splitTimeAnalysis: Array<{
      event: string;
      phase: string;
      time: number;
      percentage: number;
    }> = [];
    
    completedRuns.forEach((item) => {
      if (item.splitTimes && Object.keys(item.splitTimes).length > 0) {
        const total = item.totalTimeSeconds || 0;
        // Use total time for percentage calculation
        // Note: If split times sum > total, percentages will exceed 100%, indicating invalid data
        const baseTotal = total || 1; // Avoid division by zero
        Object.entries(item.splitTimes).forEach(([phase, time]) => {
          // Cap percentage at 100% to handle edge cases gracefully
          const percentage = baseTotal > 0 
            ? Math.min(100, Math.round((time / baseTotal) * 100))
            : 0;
          splitTimeAnalysis.push({
            event: `${item.eventCode}${item.attemptNo > 1 ? ` (R${item.attemptNo})` : ""}`,
            phase,
            time,
            percentage,
          });
        });
      }
    });
    
    // Group split times by phase for comparison
    const splitTimeByPhase = new Map<string, number[]>();
    splitTimeAnalysis.forEach((split) => {
      if (!splitTimeByPhase.has(split.phase)) {
        splitTimeByPhase.set(split.phase, []);
      }
      splitTimeByPhase.get(split.phase)!.push(split.time);
    });
    
    const splitTimeSummary = Array.from(splitTimeByPhase.entries()).map(([phase, times]) => ({
      phase,
      avgTime: times.reduce((sum, t) => sum + t, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      count: times.length,
    }));
    
    // 4. Benchmark Comparison (using historical data from insights)
    const benchmarkData = completedRuns.map((item) => {
      // Use mock historical data for now - in production, fetch from API
      const mockHistorical = {
        A1: { avg: 120, best: 110 },
        A3: { avg: 125, best: 115 },
        F9: { avg: 130, best: 120 },
      } as Record<string, { avg: number; best: number }>;
      
      const historical = mockHistorical[item.eventCode] || { avg: 0, best: 0 };
      const totalTime = item.totalTimeSeconds || 0;
      const penalty = item.penaltySeconds || 0;
      const cleanTime = Math.max(0, totalTime - penalty); // Ensure clean time is never negative
      
      return {
        event: `${item.eventCode}${item.attemptNo > 1 ? ` (R${item.attemptNo})` : ""}`,
        sequence: item.sequenceNo,
        current: cleanTime,
        historicalAvg: historical.avg,
        historicalBest: historical.best,
        vsAvg: historical.avg > 0 ? ((cleanTime - historical.avg) / historical.avg) * 100 : 0,
        vsBest: historical.best > 0 ? ((cleanTime - historical.best) / historical.best) * 100 : 0,
      };
    });
    
    // 5. Pacing Analysis (completion tracking)
    const pacingData = sortedQueue.map((item, index) => {
      const completedUpTo = sortedQueue.slice(0, index + 1).filter((i) => i.status === "RUN").length;
      const totalUpTo = index + 1;
      const expectedCompletion = totalUpTo > 0 ? (completedUpTo / totalUpTo) * 100 : 0;
      const actualCompletion = sortedQueue.length > 0
        ? (completedRuns.length / sortedQueue.length) * 100
        : 0;
      
      return {
        sequence: item.sequenceNo,
        expected: expectedCompletion,
        actual: actualCompletion,
        ahead: actualCompletion > expectedCompletion,
        behind: actualCompletion < expectedCompletion,
      };
    });
    
    // 5b. Energy & Fatigue Pacing Analysis
    const historicalDataForPacing: Record<string, {
      avgTime?: number;
      bestTime?: number;
      avgPenalty?: number;
    }> = {};
    
    // Build historical data from completed runs
    completedRuns.forEach(run => {
      if (!historicalDataForPacing[run.eventCode]) {
        historicalDataForPacing[run.eventCode] = {};
      }
      const data = historicalDataForPacing[run.eventCode];
      const times: number[] = [];
      const penalties: number[] = [];
      
      completedRuns.filter(r => r.eventCode === run.eventCode).forEach(r => {
        if (r.totalTimeSeconds) {
          const penalty = r.penaltySeconds || 0;
          const time = Math.max(0, r.totalTimeSeconds - penalty);
          times.push(time);
          penalties.push(penalty);
        }
      });
      
      if (times.length > 0) {
        data.avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
        data.bestTime = Math.min(...times);
        data.avgPenalty = penalties.length > 0 ? penalties.reduce((sum, p) => sum + p, 0) / penalties.length : 0;
      }
    });
    
    // Add mock historical data for events without completed runs
    const mockHistoricalData: Record<string, {
      avgTime?: number;
      bestTime?: number;
      avgPenalty?: number;
    }> = {
      A1: { avgTime: 120, bestTime: 110, avgPenalty: 5 },
      A3: { avgTime: 125, bestTime: 115, avgPenalty: 6 },
      A5: { avgTime: 130, bestTime: 120, avgPenalty: 7 },
      A7: { avgTime: 135, bestTime: 125, avgPenalty: 8 },
      F9: { avgTime: 140, bestTime: 130, avgPenalty: 10 },
      F11: { avgTime: 145, bestTime: 135, avgPenalty: 12 },
      P13: { avgTime: 150, bestTime: 140, avgPenalty: 8 },
      P15: { avgTime: 155, bestTime: 145, avgPenalty: 9 },
      P17: { avgTime: 160, bestTime: 150, avgPenalty: 10 },
    };
    
    // Merge actual data with mock data (actual takes precedence)
    const pacingHistoricalData = { ...mockHistoricalData, ...historicalDataForPacing };
    
    const pacingAnalysis = analyzePacing(sortedQueue, pacingHistoricalData);
    
    // 6. Strategic Insights Summary
    const insights = {
      totalRuns: sortedQueue.length,
      completed: completedRuns.length,
      remaining: remainingRuns,
      completionRate: sortedQueue.length > 0 ? (completedRuns.length / sortedQueue.length) * 100 : 0,
      avgTime: avgTimePerRun,
      pacingAnalysis,
      totalPenalty: completedRuns.reduce((sum, item) => sum + (item.penaltySeconds || 0), 0),
      anomalies: anomalies.length,
      onTrack: estimatedTimeRemaining > 0 && estimatedTimeRemaining < 3600 * 4, // Less than 4 hours
    };

    return {
      timeDistribution,
      performanceOverTime,
      penaltyAnalysis,
      eventTypePerformance,
      teamComparison,
      bestCleanTime,
      avgCleanTime,
      // Advanced analytics
      predictiveCompletion: {
        estimatedTimeRemaining,
        estimatedCompletionTime,
        optimisticTime,
        pessimisticTime,
        remainingRuns,
        avgTimePerRun,
      },
      pacingAnalysis,
      anomalies,
      splitTimeAnalysis,
      splitTimeSummary,
      benchmarkData,
      pacingData,
      insights,
    };
  }, [competitionDay, sortedQueue]);

  // Keyboard shortcuts - must be before early returns
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        // Allow Ctrl/Cmd+S to save current time entry
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
          e.preventDefault();
          if (focusedItemIndex !== null && sortedQueue[focusedItemIndex]) {
            saveTimes(sortedQueue[focusedItemIndex].id);
          }
          return;
        }
        // Allow Ctrl/Cmd+K to focus custom event input
        if ((e.ctrlKey || e.metaKey) && e.key === "k") {
          e.preventDefault();
          const input = document.querySelector('input[placeholder*="Enter event code"]') as HTMLInputElement;
          if (input) {
            input.focus();
            input.select();
          }
          return;
        }
        return;
      }

      // Escape: Close dialogs, cancel editing
      if (e.key === "Escape") {
        if (confirmDialog.isOpen) {
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        } else if (editingNotesId) {
          cancelEditingNotes();
        } else if (showKeyboardHelp) {
          setShowKeyboardHelp(false);
        }
        return;
      }

      // ?: Show keyboard help
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        setShowKeyboardHelp(true);
        return;
      }

      // Arrow Up/Down: Navigate between queue items
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        if (sortedQueue.length === 0) return;
        const currentIndex = focusedItemIndex ?? 0;
        const newIndex = e.key === "ArrowUp"
          ? Math.max(0, currentIndex - 1)
          : Math.min(sortedQueue.length - 1, currentIndex + 1);
        setFocusedItemIndex(newIndex);
        // Scroll into view
        const element = document.querySelector(`[data-queue-item-index="${newIndex}"]`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      // Enter: Confirm/add current action (only if not in input)
      if (e.key === "Enter" && !e.shiftKey) {
        if (focusedItemIndex !== null && sortedQueue[focusedItemIndex]) {
          const item = sortedQueue[focusedItemIndex];
          if (item.status === "PLANNED") {
            updateQueueItem(item.id, { status: "RUN" });
          }
        }
        return;
      }

      // Ctrl/Cmd + A: Select all items (when not in input)
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        if (competitionDay && competitionDay.queueItems.length > 0) {
          toggleSelectAll();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedItemIndex, sortedQueue, confirmDialog.isOpen, editingNotesId, showKeyboardHelp, selectedItems.size]);

  // Early returns must come AFTER all hooks
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

  // TypeScript now knows competitionDay is not null after the check above
  const competitionDayData = competitionDay;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <button
            onClick={() => navigate("/app/competition-days")}
            className="text-blue-600 hover:underline flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Competition Days
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Offline indicator */}
            {isOffline && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 border border-yellow-300 rounded text-sm text-yellow-800">
                <span>⚠️ Offline</span>
                {pendingActions > 0 && (
                  <span className="font-medium">{pendingActions} pending</span>
                )}
              </div>
            )}
            {/* Export & Share buttons */}
            <div className="flex items-center gap-2 border-r border-gray-300 pr-2 no-print">
              <button
                onClick={() => {
                  if (competitionDay) {
                    exportToCSV(competitionDay);
                    toast.success("CSV exported successfully");
                  }
                }}
                className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                title="Export to CSV"
              >
                📥 CSV
              </button>
              <button
                onClick={() => {
                  if (competitionDay) {
                    exportToPDF(competitionDay);
                    toast.info("Opening print dialog...");
                  }
                }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                title="Export to PDF"
              >
                📄 PDF
              </button>
              <button
                onClick={async () => {
                  if (id) {
                    const success = await copyShareableLink(id);
                    if (success) {
                      toast.success("Link copied to clipboard!");
                    } else {
                      toast.error("Failed to copy link");
                    }
                  }
                }}
                className="px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm font-medium"
                title="Copy shareable link"
              >
                🔗 Share
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium"
                title="Print view"
              >
                🖨️ Print
              </button>
            </div>
            {auth.isAdmin() && (
              <>
                <button
                  onClick={() => navigate(`/app/competition-days/${id}/edit`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 no-print"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteCompetitionDay()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 no-print"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{competitionDayData.challengeName}</h1>
        <div className="mt-2 text-gray-600 space-y-1">
          <p>
            {new Date(competitionDayData.date).toLocaleDateString("en-NZ", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p>{competitionDayData.locationName}</p>
          {competitionDayData.trackName && <p>Track: {competitionDayData.trackName}</p>}
          {competitionDayData.notes && <p className="text-sm italic">{competitionDayData.notes}</p>}
          {competitionDayData.teams && Array.isArray(competitionDayData.teams) && competitionDayData.teams.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-700 mb-1">Competing Teams:</p>
              <div className="flex flex-wrap gap-2">
                {competitionDayData.teams.map((team, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800"
                  >
                    {team}
                  </span>
                ))}
              </div>
            </div>
          )}
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
                  disabled={loadingStates.addingItem}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base touch-manipulation min-h-[44px]"
                >
                  {loadingStates.addingItem ? "..." : eventCode}
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
                disabled={loadingStates.addingItem || !customEventCode.trim()}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base touch-manipulation min-h-[44px]"
              >
                {loadingStates.addingItem ? "..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced AI Insights Panel */}
      {insights.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow-lg p-6 border-2 border-indigo-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                🤖 AI-Powered Insights
                {insights.length > 0 && (
                  <span className="text-sm font-normal text-gray-600 bg-white px-2 py-1 rounded-full border border-indigo-200">
                    {insights.length} insight{insights.length !== 1 ? "s" : ""}
                  </span>
                )}
              </h2>
              <p className="text-sm text-gray-600 mt-1">Prioritized recommendations and strategic analysis</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                title="How insights work"
                onClick={(e) => {
                  e.preventDefault();
                  alert(`HOW INSIGHTS WORK:\n\n• Insights are automatically generated using AI analysis\n• They're prioritized by impact (high/medium/low)\n• Priority score (1-10) shows importance\n• Confidence shows how certain the insight is\n• Estimated improvement shows potential gains\n• Action items provide specific steps\n\nInsight Types:\n• Prediction: Time forecasts for upcoming runs\n• Anomaly: Unusual performances detected\n• Suggestion: Strategic recommendations\n• Coaching: Technique and training tips\n• Strategy: Run order and pacing advice\n• Risk: Warnings about potential issues\n\nUse insights to:\n- Make data-driven decisions\n- Identify improvement opportunities\n- Prevent problems before they occur\n- Optimize performance`);
                }}
              >
                ℹ️ How It Works
              </button>
              <button
                onClick={() => setShowInsights(!showInsights)}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                {showInsights ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {showInsights && (
            <div className="space-y-4">
              {/* High Priority Insights First */}
              {insights
                .filter((i) => (i.priority || 0) >= 7)
                .map((insight, idx) => (
                  <div
                    key={`high-${idx}`}
                    className={`p-4 rounded-lg border-2 shadow-sm ${
                      insight.severity === "error"
                        ? "bg-red-50 border-red-400"
                        : insight.severity === "warning"
                        ? "bg-orange-50 border-orange-400"
                        : "bg-blue-50 border-blue-400"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900">{insight.title}</span>
                          {insight.priority && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded border border-red-300">
                              Priority {insight.priority}/10
                            </span>
                          )}
                          {insight.impact && (
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${
                              insight.impact === "high"
                                ? "bg-red-100 text-red-700 border-red-300"
                                : insight.impact === "medium"
                                ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                                : "bg-gray-100 text-gray-700 border-gray-300"
                            }`}>
                              {insight.impact.toUpperCase()} IMPACT
                            </span>
                          )}
                          {insight.type && (
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded border border-indigo-300">
                              {insight.type.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{insight.message}</p>
                        {insight.estimatedImprovement && (
                          <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                            <p className="text-xs font-semibold text-green-700">
                              💡 Potential: {insight.estimatedImprovement}
                            </p>
                          </div>
                        )}
                        {insight.actionItems && insight.actionItems.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Action Items:</p>
                            <ul className="space-y-1">
                              {insight.actionItems.map((action, actionIdx) => (
                                <li key={actionIdx} className="flex items-start gap-2 text-xs text-gray-700">
                                  <span className="text-indigo-600 mt-0.5">→</span>
                                  <span>{action}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {insight.confidence && (
                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                            <span>Confidence: {Math.round(insight.confidence * 100)}%</span>
                            {insight.impactScore && (
                              <span className="font-semibold text-indigo-600">
                                Impact Score: {insight.impactScore}/100
                              </span>
                            )}
                            {insight.urgency && (
                              <span className={`px-2 py-0.5 rounded ${
                                insight.urgency === "immediate" ? "bg-red-100 text-red-700" :
                                insight.urgency === "soon" ? "bg-orange-100 text-orange-700" :
                                "bg-blue-100 text-blue-700"
                              }`}>
                                {insight.urgency === "immediate" ? "⚡ Immediate" :
                                 insight.urgency === "soon" ? "⏰ Soon" : "📅 Planning"}
                              </span>
                            )}
                            {insight.difficulty && (
                              <span className={`px-2 py-0.5 rounded ${
                                insight.difficulty === "easy" ? "bg-green-100 text-green-700" :
                                insight.difficulty === "medium" ? "bg-yellow-100 text-yellow-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {insight.difficulty === "easy" ? "✓ Easy" :
                                 insight.difficulty === "medium" ? "⚙ Medium" : "⚠ Hard"}
                              </span>
                            )}
                          </div>
                        )}
                        {insight.historicalContext && (
                          <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                            <p className="text-xs font-semibold text-blue-700 mb-1">📊 Historical Context</p>
                            <p className="text-xs text-blue-600">
                              {insight.historicalContext.trend === "improving" ? "↑" :
                               insight.historicalContext.trend === "declining" ? "↓" : "→"} 
                              {" "}{insight.historicalContext.comparison}
                              {insight.historicalContext.dataPoints > 0 && 
                                ` (based on ${insight.historicalContext.dataPoints} historical data point${insight.historicalContext.dataPoints > 1 ? "s" : ""})`}
                            </p>
                          </div>
                        )}
                        {insight.expectedOutcome && (
                          <div className="mt-2 p-2 bg-purple-50 rounded border border-purple-200">
                            <p className="text-xs font-semibold text-purple-700 mb-1">🎯 Expected Outcome</p>
                            <p className="text-xs text-purple-600">{insight.expectedOutcome}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              
              {/* Medium Priority Insights */}
              {insights
                .filter((i) => (i.priority || 0) >= 4 && (i.priority || 0) < 7)
                .map((insight, idx) => (
                  <div
                    key={`med-${idx}`}
                    className={`p-3 rounded-lg border-l-4 ${
                      insight.severity === "error"
                        ? "bg-red-50 border-red-500"
                        : insight.severity === "warning"
                        ? "bg-yellow-50 border-yellow-500"
                        : "bg-blue-50 border-blue-500"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{insight.title}</span>
                          {insight.impact && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              insight.impact === "high" ? "bg-red-100 text-red-700" :
                              insight.impact === "medium" ? "bg-yellow-100 text-yellow-700" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {insight.impact}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{insight.message}</p>
                        {insight.estimatedImprovement && (
                          <p className="text-xs text-green-600 mt-1 font-medium">
                            💡 {insight.estimatedImprovement}
                          </p>
                        )}
                        {insight.actionItems && insight.actionItems.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-600">Actions: {insight.actionItems.slice(0, 2).join(", ")}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              
              {/* Low Priority / Info Insights */}
              {insights
                .filter((i) => (i.priority || 0) < 4)
                .map((insight, idx) => (
                  <div
                    key={`low-${idx}`}
                    className="p-3 rounded-lg border border-gray-200 bg-white"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-blue-500">ℹ️</span>
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{insight.title}</span>
                        <p className="text-sm text-gray-600 mt-1">{insight.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              
              {/* Summary Stats */}
              <div className="mt-4 pt-4 border-t border-indigo-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">
                      {insights.filter((i) => (i.priority || 0) >= 7).length}
                    </p>
                    <p className="text-gray-600">High Priority</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">
                      {insights.filter((i) => i.impact === "high").length}
                    </p>
                    <p className="text-gray-600">High Impact</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">
                      {insights.filter((i) => i.type === "risk").length}
                    </p>
                    <p className="text-gray-600">Risks</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">
                      {insights.filter((i) => i.estimatedImprovement).length}
                    </p>
                    <p className="text-gray-600">With Estimates</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress Indicator */}
      {sortedQueue.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Progress</h3>
            <span className="text-sm text-gray-600">
              {progress.completed} of {progress.total} runs completed ({progress.percentage}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-green-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-600"></span>
              RUN: {sortedQueue.filter((item) => item.status === "RUN").length}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-600"></span>
              PLANNED: {sortedQueue.filter((item) => item.status === "PLANNED").length}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-gray-400"></span>
              SKIPPED: {sortedQueue.filter((item) => item.status === "SKIPPED").length}
            </span>
          </div>
        </div>
      )}

      {/* Enhanced Visualizations */}
      {sortedQueue.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              📊 Visualizations
            </h2>
            <button
              onClick={() => setShowVisualizations(!showVisualizations)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showVisualizations ? "Hide" : "Show"}
            </button>
          </div>
          {showVisualizations && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Performance Over Time - Shows if times degrade through the day */}
              {visualizationData.performanceOverTime.length > 0 && (
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Performance Over Time</h3>
                      <p className="text-xs text-gray-500 mt-1">Fatigue & Consistency Analysis</p>
                    </div>
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800"
                      title="How to read this chart"
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`HOW TO READ:\n\n• X-axis: Sequence number (order of runs)\n• Y-axis: Time (without penalties)\n• Green line: Your actual times\n• Blue dashed line: Average time (reference)\n• Upward trend = Possible fatigue (times getting slower)\n• Downward trend = Improving performance\n• Flat line = Consistent performance\n\nLook for patterns - if times increase significantly, consider taking a break.`);
                      }}
                    >
                      ℹ️ How to Read
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={visualizationData.performanceOverTime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="sequence" 
                        label={{ value: "Run Sequence Number", position: "insideBottom", offset: -5 }}
                      />
                      <YAxis 
                        tickFormatter={(value) => formatTime(value)}
                        label={{ value: "Time (seconds)", angle: -90, position: "insideLeft" }}
                      />
                      <Tooltip
                        formatter={(value: number) => formatTime(value)}
                        labelFormatter={(label) => `Run #${label}`}
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="cleanTime"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ fill: "#10b981", r: 4 }}
                        name="Your Time"
                      />
                      {visualizationData.avgCleanTime && visualizationData.avgCleanTime > 0 && (
                        <ReferenceLine 
                          y={visualizationData.avgCleanTime} 
                          stroke="#3b82f6" 
                          strokeDasharray="5 5"
                          label={{ value: "Your Average", position: "right" }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-gray-700">
                    {visualizationData.performanceOverTime.length > 1 && 
                      (() => {
                        const first = visualizationData.performanceOverTime[0].cleanTime;
                        const last = visualizationData.performanceOverTime[visualizationData.performanceOverTime.length - 1].cleanTime;
                        const trend = last - first;
                        return trend > 0 
                          ? `⚠️ Times increased by ${formatTime(trend)} - possible fatigue detected`
                          : trend < 0
                          ? `✅ Times improved by ${formatTime(Math.abs(trend))} - performance getting better`
                          : "→ Times consistent - maintaining steady pace";
                      })()
                    }
                  </div>
                </div>
              )}

              {/* Enhanced Time Distribution with Best/Average Reference */}
              {visualizationData.timeDistribution.length > 0 && (
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Time Distribution</h3>
                      <p className="text-xs text-gray-500 mt-1">Total Time vs Time by Run</p>
                    </div>
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800"
                      title="How to read this chart"
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`HOW TO READ:\n\n• X-axis: Event codes (runs in sequence order)\n• Y-axis: Time in seconds\n• Blue bars: Total time (includes penalties)\n• Green bars: Time (without penalties)\n• Orange dashed line: Your average time\n• Gap between blue and green = penalty time\n\nLarger gaps indicate more penalties. Compare your times to see which runs were fastest.`);
                      }}
                    >
                      ℹ️ How to Read
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={visualizationData.timeDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 10 }}
                        label={{ value: "Event Code", position: "insideBottom", offset: -5 }}
                      />
                      <YAxis 
                        tickFormatter={(value) => formatTime(value)}
                        label={{ value: "Time (seconds)", angle: -90, position: "insideLeft" }}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          return [formatTime(value), name === "time" ? "Total Time (with penalties)" : "Time (no penalties)"];
                        }}
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
                      />
                      <Legend />
                      <Bar dataKey="time" fill="#3b82f6" name="Total Time (with penalties)" />
                      <Bar dataKey="cleanTime" fill="#10b981" name="Time (no penalties)" />
                      {visualizationData.avgCleanTime && visualizationData.avgCleanTime > 0 && (
                        <ReferenceLine 
                          y={visualizationData.avgCleanTime} 
                          stroke="#f59e0b" 
                          strokeDasharray="3 3"
                          label={{ value: "Your Average", position: "right" }}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                    {visualizationData.bestCleanTime && visualizationData.bestCleanTime > 0 && visualizationData.avgCleanTime && (
                      <div className="flex gap-4 text-gray-700">
                        <span><strong>Best:</strong> {formatTime(visualizationData.bestCleanTime)}</span>
                        <span><strong>Average:</strong> {formatTime(visualizationData.avgCleanTime)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Enhanced Penalty Analysis with Percentages */}
              {visualizationData.penaltyAnalysis.length > 0 && (
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Penalty Impact Analysis</h3>
                      <p className="text-xs text-gray-500 mt-1">Which Runs Have Highest Penalty Impact</p>
                    </div>
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800"
                      title="How to read this chart"
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`HOW TO READ:\n\n• Y-axis: Event codes (sorted by penalty impact)\n• X-axis: Penalty as % of total time\n• Red bars: Penalty percentage\n• Longer bars = higher penalty impact\n• Sorted from highest to lowest impact\n\nFocus on runs with highest percentages - these have the most room for improvement. A 20% penalty means 1/5 of your time was penalties!`);
                      }}
                    >
                      ℹ️ How to Read
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={visualizationData.penaltyAnalysis} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        type="number" 
                        tickFormatter={(value) => `${value}%`}
                        label={{ value: "Penalty % of Total Time", position: "insideBottom", offset: -5 }}
                      />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={100} 
                        tick={{ fontSize: 10 }}
                        label={{ value: "Event Code", angle: -90, position: "insideLeft" }}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === "penaltyPercentage") return [`${value}% of total time`, "Penalty Impact"];
                          return [formatTime(value), name];
                        }}
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
                      />
                      <Legend />
                      <Bar dataKey="penaltyPercentage" fill="#ef4444" name="Penalty % of Total Time" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-2 p-2 bg-red-50 rounded text-xs text-gray-700">
                    <strong>Interpretation:</strong> Higher percentage = more impact. A 20% penalty means 1/5 of your time was penalties. Focus training on runs with highest percentages.
                  </div>
                </div>
              )}

              {/* Event Type Performance */}
              {visualizationData.eventTypePerformance.length > 0 && (
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Performance by Event Type</h3>
                      <p className="text-xs text-gray-500 mt-1">Compare A, F, and P Event Categories</p>
                    </div>
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800"
                      title="How to read this chart"
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`HOW TO READ:\n\n• X-axis: Event type (A=Agility, F=Freestyle, P=Precision)\n• Y-axis: Time in seconds\n• Green bars: Your best time for this event type\n• Blue bars: Your average time\n• Red bars: Your worst time\n• Gap between bars = consistency (smaller gap = more consistent)\n\nUse this to identify:\n- Which event types you're strongest at (lowest times)\n- Which need improvement (highest times)\n- Your consistency (gap between best/worst)`);
                      }}
                    >
                      ℹ️ How to Read
                    </button>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={visualizationData.eventTypePerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="type" 
                        label={{ value: "Event Type (A=Agility, F=Freestyle, P=Precision)", position: "insideBottom", offset: -5 }}
                      />
                      <YAxis 
                        tickFormatter={(value) => formatTime(value)}
                        label={{ value: "Time (seconds)", angle: -90, position: "insideLeft" }}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          const labels: Record<string, string> = {
                            best: "Your Best Time",
                            average: "Your Average Time",
                            worst: "Your Worst Time"
                          };
                          return [formatTime(value), labels[name] || name];
                        }}
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
                      />
                      <Legend />
                      <Bar dataKey="best" fill="#10b981" name="Your Best Time" />
                      <Bar dataKey="average" fill="#3b82f6" name="Your Average Time" />
                      <Bar dataKey="worst" fill="#ef4444" name="Your Worst Time" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700">
                    <strong>Legend:</strong> A = Agility events | F = Freestyle events | P = Precision events. Smaller gap between bars = more consistent performance.
                  </div>
                </div>
              )}

              {/* Team/Competitor Comparison */}
              {visualizationData.teamComparison.length > 0 && (
                <div className="lg:col-span-2">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Team Comparison</h3>
                      <p className="text-xs text-gray-500 mt-1">Compare Performance Across Teams</p>
                    </div>
                    <button
                      className="text-xs text-blue-600 hover:text-blue-800"
                      title="How to read this chart"
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`HOW TO READ:\n\n• Each chart shows one event\n• Y-axis: Team names\n• X-axis: Time (shorter = faster)\n• Green bars: Best performing team (fastest time)\n• Blue bars: Other teams\n• Shorter bars = faster times = better performance\n\nUse this to:\n- See which team performed best on each event\n- Identify your team's strengths and weaknesses\n- Compare your team against competitors`);
                      }}
                    >
                      ℹ️ How to Read
                    </button>
                  </div>
                  <div className="space-y-4">
                    {visualizationData.teamComparison.map((eventData, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">{eventData.event}</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={eventData.teams} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              type="number" 
                              tickFormatter={(value) => formatTime(value)}
                              label={{ value: "Time (seconds)", position: "insideBottom", offset: -5 }}
                            />
                            <YAxis 
                              dataKey="team" 
                              type="category" 
                              width={120}
                              label={{ value: "Team", angle: -90, position: "insideLeft" }}
                            />
                            <Tooltip
                              formatter={(value: number) => formatTime(value)}
                              contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
                            />
                            <Legend />
                            <Bar 
                              dataKey="cleanTime" 
                              name="Time"
                              fill="#3b82f6"
                            >
                              {eventData.teams.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.isBest ? "#10b981" : "#3b82f6"} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <p className="text-xs text-gray-500 mt-2">
                          🏆 Green = Best time | Blue = Other teams
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Show message if no data for visualizations */}
              {visualizationData.timeDistribution.length === 0 &&
                visualizationData.performanceOverTime.length === 0 &&
                visualizationData.penaltyAnalysis.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-gray-500">
                    <p>No data available for visualizations yet.</p>
                    <p className="text-sm mt-2">Complete some runs to see charts.</p>
                  </div>
                )}
            </div>
          )}

          {/* Advanced Analytics Section */}
          {showVisualizations && (
            <div className="mt-8 pt-8 border-t border-gray-300">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    🎯 Advanced Analytics
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">Predictive insights and strategic analysis</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Predictive Completion Time */}
                {visualizationData.predictiveCompletion && visualizationData.predictiveCompletion.remainingRuns > 0 && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border-2 border-blue-300 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-1">
                          ⏱️ Predictive Completion Time
                        </h4>
                        <p className="text-xs text-gray-600">When will the competition finish?</p>
                      </div>
                      <button
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        title="How to read this"
                        onClick={(e) => {
                          e.preventDefault();
                          alert(`HOW TO READ:\n\n• Estimated Time Remaining: How long until all runs are complete (based on current pace)\n• Estimated Completion: Clock time when competition should finish\n• Optimistic: Best-case scenario (if you maintain your fastest pace)\n• Pessimistic: Worst-case scenario (if you slow down)\n\nThis updates as you complete more runs. More completed runs = more accurate prediction.\n\nUse this to:\n- Plan breaks and meals\n- Coordinate with venue staff\n- Set expectations for finish time`);
                        }}
                      >
                        ℹ️ How to Read
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg p-3 border border-blue-200">
                        <p className="text-xs text-gray-600 mb-1 font-medium">Estimated Time Remaining</p>
                        <p className="text-3xl font-bold text-blue-700">
                          {formatTime(visualizationData.predictiveCompletion.estimatedTimeRemaining)}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-blue-200">
                        <p className="text-xs text-gray-600 mb-1 font-medium">Estimated Completion Time</p>
                        <p className="text-xl font-semibold text-gray-900">
                          {visualizationData.predictiveCompletion.estimatedCompletionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-green-50 rounded p-2 border border-green-200">
                          <p className="text-xs text-gray-600 mb-1">Optimistic</p>
                          <p className="text-sm font-semibold text-green-700">
                            {formatTime(visualizationData.predictiveCompletion.optimisticTime)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Best case</p>
                        </div>
                        <div className="bg-red-50 rounded p-2 border border-red-200">
                          <p className="text-xs text-gray-600 mb-1">Pessimistic</p>
                          <p className="text-sm font-semibold text-red-700">
                            {formatTime(visualizationData.predictiveCompletion.pessimisticTime)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">Worst case</p>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-blue-200">
                        <p className="text-xs text-gray-600">
                          📊 Based on <strong>{visualizationData.insights.completed}</strong> completed runs, 
                          <strong> {visualizationData.predictiveCompletion.remainingRuns}</strong> remaining
                        </p>
                        <p className="text-xs text-gray-500 mt-1 italic">
                          Accuracy improves with more completed runs
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Strategic Insights Summary */}
                {visualizationData.insights && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-6 border-2 border-purple-300 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-1">
                          💡 Strategic Insights Dashboard
                        </h4>
                        <p className="text-xs text-gray-600">Key metrics at a glance</p>
                      </div>
                      <button
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                        title="How to read this"
                        onClick={(e) => {
                          e.preventDefault();
                          alert(`HOW TO READ:\n\n• Completion Rate: % of runs completed (higher = better progress)\n• Avg Time per Run: Your average time (used for predictions)\n• Total Penalties: Sum of all penalty time (lower = better)\n• Anomalies Detected: Unusual performances (0 = normal, >0 = review)\n• On Track: Green check = pacing well for completion\n\nUse this as a quick health check:\n- Low completion rate = need to speed up\n- High penalties = focus on technique\n- Many anomalies = review data for errors\n- Off track = adjust pace`);
                        }}
                      >
                        ℹ️ How to Read
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-white rounded-lg p-3 border border-purple-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">Completion Rate</span>
                          <span className="text-lg font-bold text-purple-700">
                            {visualizationData.insights.completionRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(100, visualizationData.insights.completionRate)}%` }}
                          />
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-purple-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">Avg Time per Run</span>
                          <span className="text-lg font-semibold text-gray-900">
                            {formatTime(visualizationData.insights.avgTime)}
                          </span>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-red-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">Total Penalties</span>
                          <span className="text-lg font-semibold text-red-600">
                            {formatTime(visualizationData.insights.totalPenalty)}
                          </span>
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-orange-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-700">Anomalies Detected</span>
                          <span className={`text-lg font-semibold ${visualizationData.insights.anomalies > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                            {visualizationData.insights.anomalies}
                          </span>
                        </div>
                        {visualizationData.insights.anomalies > 0 && (
                          <p className="text-xs text-orange-600 mt-1">Review flagged runs below</p>
                        )}
                      </div>
                      {visualizationData.insights.onTrack && (
                        <div className="mt-3 pt-3 border-t border-purple-200 bg-green-50 rounded p-2">
                          <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                            ✅ On track for completion
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Pacing Strategy Analyzer */}
                {visualizationData.pacingAnalysis && visualizationData.pacingAnalysis.energyCurve.length > 0 && (
                  <div className="lg:col-span-2">
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-6 border-2 border-emerald-300 shadow-sm">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-1">
                            ⚡ Pacing Strategy Analyzer
                          </h4>
                          <p className="text-xs text-gray-600">Energy management and fatigue risk analysis</p>
                        </div>
                        <button
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                          title="How to read this"
                          onClick={(e) => {
                            e.preventDefault();
                            alert(`HOW TO READ:\n\n• Energy Level: Your remaining energy (100% = fresh, 0% = exhausted)\n• Fatigue Risk: Low/Medium/High/Critical - indicates performance degradation risk\n• Break Recommendations: Optimal times to rest\n• Energy Curve: Shows how energy depletes through the day\n\n• Green zone (70-100%): Optimal performance\n• Yellow zone (40-70%): Performance may degrade\n• Red zone (0-40%): High fatigue risk\n\nUse this to:\n- Plan breaks strategically\n- Prevent fatigue-related performance drops\n- Maintain consistent performance throughout the day`);
                          }}
                        >
                          ℹ️ How to Read
                        </button>
                      </div>

                      {/* Energy Curve Chart */}
                      <div className="mb-6">
                        <h5 className="text-sm font-semibold text-gray-900 mb-3">Energy Level Over Time</h5>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={visualizationData.pacingAnalysis.energyCurve.map(point => ({
                            sequence: point.sequenceNo,
                            event: point.eventCode,
                            energyLevel: point.energyLevel,
                            cumulativeEnergy: point.cumulativeEnergy,
                            fatigueRisk: point.fatigueRisk,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="sequence" 
                              label={{ value: "Run Sequence", position: "insideBottom", offset: -5 }}
                            />
                            <YAxis 
                              label={{ value: "Energy Level (%)", angle: -90, position: "insideLeft" }}
                              domain={[0, 100]}
                            />
                            <Tooltip
                              formatter={(value: number, name: string) => {
                                if (name === "energyLevel") {
                                  return [`${value.toFixed(1)}%`, "Energy Level"];
                                }
                                return [value.toFixed(1), name];
                              }}
                              labelFormatter={(label) => `Run #${label}`}
                              contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="energyLevel"
                              stroke="#10b981"
                              strokeWidth={2}
                              dot={{ fill: "#10b981", r: 4 }}
                              name="Energy Level (%)"
                            />
                            <ReferenceLine y={70} stroke="#fbbf24" strokeDasharray="5 5" label="Optimal Zone" />
                            <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="5 5" label="Fatigue Risk" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Break Recommendations */}
                      {visualizationData.pacingAnalysis.breakRecommendations.length > 0 && (
                        <div className="mb-6">
                          <h5 className="text-sm font-semibold text-gray-900 mb-3">Break Recommendations</h5>
                          <div className="space-y-2">
                            {visualizationData.pacingAnalysis.breakRecommendations.map((rec, idx) => (
                              <div
                                key={idx}
                                className={`p-3 rounded-lg border ${
                                  rec.priority === "high"
                                    ? "bg-red-50 border-red-200"
                                    : rec.priority === "medium"
                                    ? "bg-yellow-50 border-yellow-200"
                                    : "bg-blue-50 border-blue-200"
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-900">
                                      After {rec.afterEvent} (Run #{rec.afterSequence})
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">{rec.reason}</p>
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className={`text-lg font-bold ${
                                      rec.priority === "high" ? "text-red-700" :
                                      rec.priority === "medium" ? "text-yellow-700" :
                                      "text-blue-700"
                                    }`}>
                                      {rec.duration} min
                                    </p>
                                    <p className="text-xs text-gray-500">break</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Fatigue Warnings */}
                      {visualizationData.pacingAnalysis.fatigueWarnings.length > 0 && (
                        <div className="mb-6">
                          <h5 className="text-sm font-semibold text-red-900 mb-3">⚠️ Fatigue Warnings</h5>
                          <div className="space-y-2">
                            {visualizationData.pacingAnalysis.fatigueWarnings.map((warning, idx) => (
                              <div
                                key={idx}
                                className={`p-3 rounded-lg border ${
                                  warning.severity === "critical"
                                    ? "bg-red-100 border-red-300"
                                    : "bg-orange-100 border-orange-300"
                                }`}
                              >
                                <p className="text-sm font-semibold text-gray-900">
                                  {warning.eventCode} (Run #{warning.sequenceNo})
                                </p>
                                <p className="text-xs text-gray-700 mt-1">{warning.message}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}


                      {/* Summary Stats */}
                      <div className="mt-6 pt-4 border-t border-emerald-200 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="text-center">
                          <p className="text-xs text-gray-600">Peak Fatigue</p>
                          <p className="text-lg font-bold text-gray-900">
                            Run #{visualizationData.pacingAnalysis.peakFatiguePoint}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-600">Total Energy</p>
                          <p className="text-lg font-bold text-gray-900">
                            {visualizationData.pacingAnalysis.totalEstimatedEnergy.toFixed(1)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-600">Break Opportunities</p>
                          <p className="text-lg font-bold text-emerald-700">
                            {visualizationData.pacingAnalysis.recoveryOpportunities}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-600">Fatigue Warnings</p>
                          <p className={`text-lg font-bold ${
                            visualizationData.pacingAnalysis.fatigueWarnings.length > 0 ? "text-red-600" : "text-green-600"
                          }`}>
                            {visualizationData.pacingAnalysis.fatigueWarnings.length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Anomaly Detection */}
                {visualizationData.anomalies && visualizationData.anomalies.length > 0 && (
                  <div className="lg:col-span-2">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-1">
                          ⚠️ Anomaly Detection
                        </h4>
                        <p className="text-xs text-gray-600">Unusual performances detected using statistical analysis</p>
                      </div>
                      <button
                        className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                        title="How to read this"
                        onClick={(e) => {
                          e.preventDefault();
                          alert(`HOW TO READ:\n\n• Anomalies are runs that are significantly different from your average\n• Uses Z-score: measures how many standard deviations from average\n• Z-score > 2 = unusual (either very fast or very slow)\n\n• ⚡ Fast (Green): Exceptionally fast time - celebrate or verify data\n• ⚠️ Slow (Red): Unusually slow time - check for:\n  - Data entry errors\n  - Equipment issues\n  - Fatigue or injury\n  - Penalty mistakes\n\nAction: Review each flagged run to determine if it's:\n1. A data error (correct it)\n2. Exceptional performance (celebrate!)\n3. A problem to address (investigate)`);
                        }}
                      >
                        ℹ️ How to Read
                      </button>
                    </div>
                    <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                      <p className="text-xs text-gray-700 mb-3 font-medium">
                        📊 {visualizationData.anomalies.length} run{visualizationData.anomalies.length !== 1 ? 's' : ''} flagged as unusual (Z-score &gt; 2.0)
                      </p>
                      <div className="space-y-2">
                        {visualizationData.anomalies.map((anomaly, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border-2 border-yellow-400 shadow-sm">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">{anomaly.event}</span>
                                <span className="text-xs text-gray-500">(Run #{anomaly.sequence})</span>
                              </div>
                              <div className="mt-1 text-xs text-gray-600">
                                Total: <strong>{formatTime(anomaly.time)}</strong> | 
                                Time: <strong>{formatTime(anomaly.cleanTime)}</strong>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                                anomaly.type === "slow" 
                                  ? "bg-red-100 text-red-800 border border-red-300" 
                                  : "bg-green-100 text-green-800 border border-green-300"
                              }`}>
                                {anomaly.type === "slow" ? "⚠️ Unusually Slow" : "⚡ Exceptionally Fast"}
                              </span>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Z-score</p>
                                <p className="text-sm font-bold text-gray-700">{anomaly.zScore}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs text-gray-700">
                          <strong>💡 Tip:</strong> Review each flagged run. Fast anomalies might be exceptional performance worth celebrating. 
                          Slow anomalies might indicate data errors or issues to investigate.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Benchmark Comparison */}
                {visualizationData.benchmarkData && visualizationData.benchmarkData.length > 0 && (
                  <div className="lg:col-span-2">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-1">
                          📊 Benchmark Comparison
                        </h4>
                        <p className="text-xs text-gray-600">Compare your current performance against historical data</p>
                      </div>
                      <button
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        title="How to read this chart"
                        onClick={(e) => {
                          e.preventDefault();
                          alert(`HOW TO READ:\n\n• X-axis: Event codes\n• Y-axis: Time in seconds\n• Blue bars: Your current performance\n• Gray bars: Historical average (your typical performance)\n• Green bars: Historical best (your best ever)\n\nInterpretation:\n• If blue < green = You're performing better than your best!\n• If blue < gray = You're performing better than average\n• If blue > gray = Below average (room for improvement)\n• If blue > green = Significantly below best (investigate why)\n\nUse this to:\n- See if you're improving over time\n- Identify events where you're underperforming\n- Set goals based on historical bests\n- Track progress toward personal records`);
                        }}
                      >
                        ℹ️ How to Read
                      </button>
                    </div>
                    <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={visualizationData.benchmarkData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="event"
                            angle={-45}
                            textAnchor="end"
                            height={100}
                            tick={{ fontSize: 10 }}
                            label={{ value: "Event Code", position: "insideBottom", offset: -5 }}
                          />
                          <YAxis 
                            tickFormatter={(value) => formatTime(value)}
                            label={{ value: "Time (seconds)", angle: -90, position: "insideLeft" }}
                          />
                          <Tooltip
                            formatter={(value: number, name: string) => {
                              const labels: Record<string, string> = {
                                current: "Your Current Performance",
                                historicalAvg: "Your Historical Average",
                                historicalBest: "Your Historical Best"
                              };
                              return [formatTime(value), labels[name] || name];
                            }}
                            contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
                          />
                          <Legend />
                          <Bar dataKey="current" fill="#3b82f6" name="Your Current Performance" />
                          <Bar dataKey="historicalAvg" fill="#94a3b8" name="Your Historical Average" />
                          <Bar dataKey="historicalBest" fill="#10b981" name="Your Historical Best" />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                        {visualizationData.benchmarkData.slice(0, 4).map((benchmark, idx) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="font-semibold text-gray-900 text-sm mb-2">{benchmark.event}</p>
                            <div className="space-y-1 text-xs">
                              <div className={`flex justify-between ${benchmark.vsAvg < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                <span>vs Avg:</span>
                                <span className="font-semibold">
                                  {benchmark.vsAvg > 0 ? '+' : ''}{benchmark.vsAvg.toFixed(1)}%
                                </span>
                              </div>
                              <div className={`flex justify-between ${benchmark.vsBest < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                <span>vs Best:</span>
                                <span className="font-semibold">
                                  {benchmark.vsBest > 0 ? '+' : ''}{benchmark.vsBest.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            {benchmark.vsAvg < 0 && (
                              <p className="text-xs text-green-600 mt-1 font-medium">✅ Better than avg</p>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs text-gray-700">
                          <strong>💡 Interpretation:</strong> Negative % = faster (better). Positive % = slower (needs improvement). 
                          Compare your current times to see if you're improving or need to focus on specific events.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Split Time Analysis */}
                {visualizationData.splitTimeSummary && visualizationData.splitTimeSummary.length > 0 && (
                  <div className="lg:col-span-2">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-1">
                          🔍 Split Time Analysis
                        </h4>
                        <p className="text-xs text-gray-600">Time breakdown by phase - identify where time is lost</p>
                      </div>
                      <button
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        title="How to read this chart"
                        onClick={(e) => {
                          e.preventDefault();
                          alert(`HOW TO READ:\n\n• X-axis: Phase names (parts of the run)\n• Y-axis: Time spent in that phase\n• Blue bars: Average time for this phase\n• Green bars: Best time (fastest you've done this phase)\n• Red bars: Worst time (slowest you've done this phase)\n\nInterpretation:\n• Larger bars = more time spent in that phase\n• Gap between green and red = consistency (smaller = more consistent)\n• Phases with largest average times = where most time is spent\n• Phases with large gaps = inconsistent performance\n\nUse this to:\n- Identify which phases take the most time (focus training here)\n- See which phases are inconsistent (practice these)\n- Compare phase times to optimize technique\n- Find opportunities to save time`);
                        }}
                      >
                        ℹ️ How to Read
                      </button>
                    </div>
                    <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={visualizationData.splitTimeSummary}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="phase" 
                            label={{ value: "Phase Name", position: "insideBottom", offset: -5 }}
                          />
                          <YAxis 
                            tickFormatter={(value) => formatTime(value)}
                            label={{ value: "Time (seconds)", angle: -90, position: "insideLeft" }}
                          />
                          <Tooltip
                            formatter={(value: number, name: string) => {
                              const labels: Record<string, string> = {
                                avgTime: "Average Time",
                                minTime: "Best Time (Fastest)",
                                maxTime: "Worst Time (Slowest)"
                              };
                              return [formatTime(value), labels[name] || name];
                            }}
                            contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
                          />
                          <Legend />
                          <Bar dataKey="avgTime" fill="#3b82f6" name="Average Time" />
                          <Bar dataKey="minTime" fill="#10b981" name="Best Time (Fastest)" />
                          <Bar dataKey="maxTime" fill="#ef4444" name="Worst Time (Slowest)" />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs text-gray-700">
                          <strong>💡 Coaching Tip:</strong> Focus training on phases with the largest average times or biggest gaps between best/worst. 
                          These are your biggest opportunities for improvement.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Run Queue List */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              Run Queue ({sortedQueue.length} item{sortedQueue.length !== 1 ? "s" : ""})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {sortedQueue.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                  title={selectedItems.size === sortedQueue.length ? "Deselect all" : "Select all"}
                >
                  {selectedItems.size === sortedQueue.length ? "Deselect All" : "Select All"}
                </button>
                {selectedItems.size > 0 && (
                  <span className="text-xs text-gray-600">
                    {selectedItems.size} selected
                  </span>
                )}
              </div>
            )}
            <button
              onClick={() => setShowKeyboardHelp(true)}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-300"
              title="Keyboard shortcuts (press ?)"
            >
              ⌨️ Shortcuts
            </button>
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedItems.size > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-700">
                {selectedItems.size} item{selectedItems.size !== 1 ? "s" : ""} selected
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => bulkUpdateStatus("RUN")}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {bulkActionLoading ? "..." : "Mark as RUN"}
                </button>
                <button
                  onClick={() => bulkUpdateStatus("SKIPPED")}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {bulkActionLoading ? "..." : "Mark as SKIPPED"}
                </button>
                <button
                  onClick={() => bulkUpdateStatus("PLANNED")}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {bulkActionLoading ? "..." : "Mark as PLANNED"}
                </button>
                <button
                  onClick={bulkDelete}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {bulkActionLoading ? "..." : "Delete Selected"}
                </button>
                <button
                  onClick={() => setSelectedItems(new Set())}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 disabled:opacity-50 font-medium"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}

        {sortedQueue.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No events in queue yet. Add events above.</p>
        ) : (
          <div className="space-y-2">
            {sortedQueue.map((item, index) => (
              <div
                key={item.id}
                data-queue-item-index={index}
                className={`p-4 border rounded-lg transition-all duration-200 ${
                  item.status === "RUN"
                    ? "bg-green-50 border-green-200"
                    : item.status === "SKIPPED"
                    ? "bg-gray-100 border-gray-300"
                    : "bg-white border-gray-200"
                } ${
                  focusedItemIndex === index ? "ring-2 ring-blue-500 shadow-md" : ""
                } ${
                  selectedItems.has(item.id) ? "ring-2 ring-blue-400 bg-blue-50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Checkbox for bulk selection */}
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => toggleItemSelection(item.id)}
                      disabled={bulkActionLoading}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                      aria-label={`Select ${item.eventCode}`}
                    />
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
                        {item.competitorTimes && item.competitorTimes.length > 0 && (
                          <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
                            {item.competitorTimes.length} competitor{item.competitorTimes.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      {editingNotesId === item.id ? (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            value={notesValue}
                            onChange={(e) => setNotesValue(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                saveNotes(item.id);
                              } else if (e.key === "Escape") {
                                cancelEditingNotes();
                              }
                            }}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Add notes..."
                            autoFocus
                          />
                          <button
                            onClick={() => saveNotes(item.id)}
                            disabled={loadingStates.savingNotes[item.id]}
                            className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {loadingStates.savingNotes[item.id] ? "..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEditingNotes}
                            disabled={loadingStates.savingNotes[item.id]}
                            className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-2">
                          {item.notes ? (
                            <p className="text-sm text-gray-600">{item.notes}</p>
                          ) : (
                            <p className="text-sm text-gray-400 italic">No notes</p>
                          )}
                          <button
                            onClick={() => startEditingNotes(item)}
                            disabled={loadingStates.savingNotes[item.id]}
                            className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                            title="Edit notes"
                          >
                            {item.notes ? "✏️" : "+ Notes"}
                          </button>
                        </div>
                      )}
                      {/* Time Entry */}
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Time (s) ⏱️</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={timeEntries[item.id]?.cleanTime ?? (() => {
                                const total = item.totalTimeSeconds || 0;
                                const penalty = item.penaltySeconds || 0;
                                const time = roundToTwoDecimals(Math.max(0, total - penalty));
                                return time > 0 ? time.toFixed(2) : "";
                              })()}
                              onChange={(e) => handleTimeChange(item.id, "cleanTime", e.target.value)}
                              onBlur={() => handleTimeBlur(item.id, "cleanTime")}
                              placeholder="100.00"
                              className={`w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                validationErrors[item.id]?.cleanTime ? "border-red-500" : "border-gray-300"
                              }`}
                            />
                            {validationErrors[item.id]?.cleanTime && (
                              <p className="text-xs text-red-600 mt-0.5">{validationErrors[item.id].cleanTime}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Penalty (s) ⚠️</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={timeEntries[item.id]?.penalty ?? (item.penaltySeconds ? roundToTwoDecimals(item.penaltySeconds).toFixed(2) : "0.00")}
                              onChange={(e) => handleTimeChange(item.id, "penalty", e.target.value)}
                              onBlur={() => handleTimeBlur(item.id, "penalty")}
                              placeholder="0.00"
                              className={`w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                validationErrors[item.id]?.penalty ? "border-red-500" : "border-gray-300"
                              }`}
                            />
                            {validationErrors[item.id]?.penalty && (
                              <p className="text-xs text-red-600 mt-0.5">{validationErrors[item.id].penalty}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Total</label>
                            <div className="px-2 py-1.5 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded">
                              {(() => {
                                // Get time from form input or calculate from saved data
                                const timeInput = timeEntries[item.id]?.cleanTime;
                                const time = timeInput && timeInput.trim() 
                                  ? roundToTwoDecimals(parseFloat(timeInput))
                                  : (() => {
                                      // Fallback: calculate from saved totalTime and penalty
                                      const total = item.totalTimeSeconds || 0;
                                      const penalty = item.penaltySeconds || 0;
                                      return roundToTwoDecimals(Math.max(0, total - penalty));
                                    })();
                                
                                // Get penalty from form input or saved data
                                const penaltyInput = timeEntries[item.id]?.penalty;
                                const penalty = penaltyInput && penaltyInput.trim()
                                  ? roundToTwoDecimals(parseFloat(penaltyInput) || 0)
                                  : roundToTwoDecimals(item.penaltySeconds || 0);
                                
                                // Total = time + penalty
                                const total = roundToTwoDecimals((time || 0) + penalty);
                                return total > 0 ? formatTime(total) : "-";
                              })()}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">Time + Penalty</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveTimes(item.id)}
                              disabled={loadingStates.savingTimes[item.id]}
                              className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                            >
                              {loadingStates.savingTimes[item.id] ? "Saving..." : "Save Time"}
                            </button>
                            <button
                              onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                              className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 touch-manipulation"
                              title="Show split times & competitors"
                            >
                              {expandedItemId === item.id ? "−" : "+"}
                            </button>
                            {item.competitorTimes && item.competitorTimes.length > 0 && (
                              <span className="text-xs text-purple-600 font-medium">
                                {item.competitorTimes.length} tracked
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Split Times (expanded) */}
                        {expandedItemId === item.id && (
                          <div className="mt-3 space-y-2">
                            {runSpecs[item.eventCode]?.phases && runSpecs[item.eventCode].phases.length > 0 ? (
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-sm font-semibold text-gray-900">Split Times (Phases) - Optional</h4>
                                  <span className="text-xs text-gray-500">For detailed breakdown analysis</span>
                                </div>
                                <p className="text-xs text-gray-600 mb-3">
                                  Enter phase times if available. Leave blank for historic records or when split times aren't recorded.
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {runSpecs[item.eventCode].phases.map((phase, idx) => {
                                    const phaseId = phase.id || `phase-${idx + 1}`;
                                    const phaseName = phase.name || `Phase ${idx + 1}`;
                                    return (
                                      <div key={phaseId}>
                                        <label className="block text-xs text-gray-600 mb-1">
                                          {phaseName} {phase.timeLimit && `(target: ${phase.timeLimit}s)`}
                                        </label>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          value={timeEntries[item.id]?.splitTimes?.[phaseId] || (item.splitTimes?.[phaseId] ? roundToTwoDecimals(item.splitTimes[phaseId]).toFixed(2) : "")}
                                          onChange={(e) => handleSplitTimeChange(item.id, phaseId, e.target.value)}
                                          onBlur={() => handleSplitTimeBlur(item.id, phaseId)}
                                          placeholder="Optional"
                                          className={`w-full px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                            validationErrors[item.id]?.splitTimes?.[phaseId] ? "border-red-500" : "border-gray-300"
                                          }`}
                                        />
                                        {validationErrors[item.id]?.splitTimes?.[phaseId] && (
                                          <p className="text-xs text-red-600 mt-0.5">{validationErrors[item.id].splitTimes?.[phaseId]}</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                {validationErrors[item.id]?.splitTimes?._sum && (
                                  <p className="text-xs text-red-600 mt-2">{validationErrors[item.id]?.splitTimes?._sum || ""}</p>
                                )}
                              </div>
                            ) : (
                              <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                                <p className="text-xs text-gray-600">
                                  Split times: No run specification found for {item.eventCode}. Split times can be added if you have phase breakdown data.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Competitor Times (expanded) */}
                        {expandedItemId === item.id && (
                          <div className="mt-3 space-y-3">
                            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900">Track Competitor Times</h4>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Mark which teams ran and record their times
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  setShowCompetitorForm((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
                                  if (!competitorForms[item.id]) {
                                    setCompetitorForms((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        teamName: "",
                                        cleanTime: "",
                                        penalty: "0",
                                        splitTimes: {},
                                        notes: "",
                                      },
                                    }));
                                  }
                                }}
                                className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 touch-manipulation font-medium"
                              >
                                {showCompetitorForm[item.id] ? "Cancel" : "+ Add Time"}
                              </button>
                            </div>

                            {/* Automatic Team Status Tracking */}
                            {competitionDayData.teams && competitionDayData.teams.length > 0 && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <h5 className="text-xs font-semibold text-gray-900 mb-2">Team Status</h5>
                                <p className="text-xs text-gray-600 mb-3">
                                  Mark which teams ran this event (times can be added later)
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {competitionDayData.teams.map((team) => {
                                    const competitor = item.competitorTimes?.find((c) => c.teamName === team);
                                    const ran = competitor?.ran ?? null; // null = not marked yet
                                    
                                    return (
                                      <div
                                        key={team}
                                        className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded"
                                      >
                                        <span className="text-xs font-medium text-gray-900 flex-1 truncate">{team}</span>
                                        <div className="flex gap-1">
                                          <button
                                            onClick={() => markCompetitorRan(item.id, team, true)}
                                            disabled={loadingStates.markingCompetitor[`${item.id}-${team}`]}
                                            className={`px-2 py-1 text-xs rounded touch-manipulation ${
                                              ran === true
                                                ? "bg-green-600 text-white font-semibold"
                                                : "bg-gray-200 text-gray-700 hover:bg-green-100"
                                            } disabled:opacity-50`}
                                            title="Mark as ran"
                                          >
                                            {loadingStates.markingCompetitor[`${item.id}-${team}`] ? "..." : "✓"}
                                          </button>
                                          <button
                                            onClick={() => markCompetitorRan(item.id, team, false)}
                                            disabled={loadingStates.markingCompetitor[`${item.id}-${team}`]}
                                            className={`px-2 py-1 text-xs rounded touch-manipulation ${
                                              ran === false
                                                ? "bg-red-600 text-white font-semibold"
                                                : "bg-gray-200 text-gray-700 hover:bg-red-100"
                                            } disabled:opacity-50`}
                                            title="Mark as didn't run"
                                          >
                                            {loadingStates.markingCompetitor[`${item.id}-${team}`] ? "..." : "×"}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Competitor Form */}
                            {showCompetitorForm[item.id] && (
                              <div className="p-3 bg-green-50 border border-green-200 rounded space-y-2">
                                {editingCompetitorId && (
                                  <div className="mb-2 p-2 bg-blue-100 border border-blue-300 rounded text-xs text-blue-800">
                                    ✎ Editing competitor time
                                  </div>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">Team Name</label>
                                    <input
                                      type="text"
                                      value={competitorForms[item.id]?.teamName || ""}
                                      onChange={(e) =>
                                        setCompetitorForms((prev) => ({
                                          ...prev,
                                          [item.id]: { 
                                            ...(prev[item.id] || { teamName: "", cleanTime: "", penalty: "0", splitTimes: {}, notes: "" }),
                                            teamName: e.target.value 
                                          },
                                        }))
                                      }
                                      placeholder="Team name"
                                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                      disabled={!!editingCompetitorId}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">Time (s) ⏱️</label>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={competitorForms[item.id]?.cleanTime || ""}
                                      onChange={(e) => {
                                        const v = e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
                                        setCompetitorForms((prev) => ({
                                          ...prev,
                                          [item.id]: { 
                                            ...(prev[item.id] || { teamName: "", cleanTime: "", penalty: "0", splitTimes: {}, notes: "" }),
                                            cleanTime: v 
                                          },
                                        }));
                                      }}
                                      onBlur={() => {
                                        setCompetitorForms((prev) => {
                                          const raw = prev[item.id]?.cleanTime;
                                          if (!raw || !raw.trim()) return prev;
                                          const num = parseFloat(raw);
                                          if (isNaN(num) || num < 0) return prev;
                                          return {
                                            ...prev,
                                            [item.id]: { 
                                              ...(prev[item.id] || { teamName: "", cleanTime: "", penalty: "0", splitTimes: {}, notes: "" }),
                                              cleanTime: roundToTwoDecimals(num).toFixed(2)
                                            },
                                          };
                                        });
                                      }}
                                      placeholder="100.00"
                                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">Penalty (s) ⚠️</label>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={competitorForms[item.id]?.penalty || "0.00"}
                                      onChange={(e) => {
                                        const v = e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
                                        setCompetitorForms((prev) => ({
                                          ...prev,
                                          [item.id]: { 
                                            ...(prev[item.id] || { teamName: "", cleanTime: "", penalty: "0", splitTimes: {}, notes: "" }),
                                            penalty: v 
                                          },
                                        }));
                                      }}
                                      onBlur={() => {
                                        setCompetitorForms((prev) => {
                                          const raw = prev[item.id]?.penalty;
                                          if (!raw || !raw.trim()) return prev;
                                          const num = parseFloat(raw);
                                          if (isNaN(num) || num < 0) return prev;
                                          return {
                                            ...prev,
                                            [item.id]: { 
                                              ...(prev[item.id] || { teamName: "", cleanTime: "", penalty: "0", splitTimes: {}, notes: "" }),
                                              penalty: roundToTwoDecimals(num).toFixed(2)
                                            },
                                          };
                                        });
                                      }}
                                      placeholder="0.00"
                                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">Total</label>
                                    <div className="px-2 py-1.5 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded">
                                      {(() => {
                                        const time = roundToTwoDecimals(parseFloat(competitorForms[item.id]?.cleanTime || "0") || 0);
                                        const penalty = roundToTwoDecimals(parseFloat(competitorForms[item.id]?.penalty || "0") || 0);
                                        const total = roundToTwoDecimals(time + penalty);
                                        return total > 0 ? formatTime(total) : "-";
                                      })()}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">Time + Penalty</p>
                                  </div>
                                </div>
                                {runSpecs[item.eventCode]?.phases && runSpecs[item.eventCode].phases.length > 0 && (
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <label className="block text-xs font-medium text-gray-700">Split Times (Optional)</label>
                                      <span className="text-xs text-gray-500">Leave blank if not available</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                      {runSpecs[item.eventCode].phases.map((phase, idx) => {
                                        const phaseId = phase.id || `phase-${idx + 1}`;
                                        return (
                                          <div key={phaseId}>
                                            <label className="block text-xs text-gray-600 mb-1">{phase.name || `Phase ${idx + 1}`}</label>
                                            <input
                                              type="text"
                                              inputMode="decimal"
                                              value={competitorForms[item.id]?.splitTimes?.[phaseId] || (() => {
                                                const splitTime = item.competitorTimes?.find(c => c.splitTimes?.[phaseId])?.splitTimes?.[phaseId];
                                                return splitTime ? roundToTwoDecimals(splitTime).toFixed(2) : "";
                                              })()}
                                              onChange={(e) => {
                                                const v = e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
                                                setCompetitorForms((prev) => ({
                                                  ...prev,
                                                  [item.id]: {
                                                    ...prev[item.id],
                                                    splitTimes: {
                                                      ...prev[item.id]?.splitTimes,
                                                      [phaseId]: v,
                                                    },
                                                  },
                                                }));
                                              }}
                                              onBlur={() => {
                                                setCompetitorForms((prev) => {
                                                  const raw = prev[item.id]?.splitTimes?.[phaseId];
                                                  if (typeof raw !== "string" || !raw.trim()) return prev;
                                                  const num = parseFloat(raw);
                                                  if (isNaN(num) || num < 0) return prev;
                                                  return {
                                                    ...prev,
                                                    [item.id]: {
                                                      ...prev[item.id],
                                                      splitTimes: {
                                                        ...prev[item.id]?.splitTimes,
                                                        [phaseId]: roundToTwoDecimals(num).toFixed(2),
                                                      },
                                                    },
                                                  };
                                                });
                                              }}
                                              placeholder="Optional"
                                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      if (editingCompetitorId) {
                                        updateCompetitorTime(item.id, editingCompetitorId);
                                      } else {
                                        addCompetitorTime(item.id);
                                      }
                                    }}
                                    disabled={editingCompetitorId ? loadingStates.updatingCompetitor[editingCompetitorId] : loadingStates.addingCompetitor[item.id]}
                                    className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {editingCompetitorId
                                      ? (loadingStates.updatingCompetitor[editingCompetitorId] ? "Updating..." : "Update Competitor Time")
                                      : (loadingStates.addingCompetitor[item.id] ? "Saving..." : "Save Competitor Time")}
                                  </button>
                                  {editingCompetitorId && (
                                    <button
                                      onClick={() => {
                                        cancelEditingCompetitor();
                                        setShowCompetitorForm((prev) => ({ ...prev, [item.id]: false }));
                                        setCompetitorForms((prev) => {
                                          const next = { ...prev };
                                          delete next[item.id];
                                          return next;
                                        });
                                      }}
                                      disabled={loadingStates.updatingCompetitor[editingCompetitorId]}
                                      className="px-3 py-1.5 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Competitor Comparison Table */}
                            {item.competitorTimes && item.competitorTimes.length > 0 && (
                              <div className="bg-white border border-gray-200 rounded-lg p-4">
                                <h5 className="text-sm font-semibold text-gray-900 mb-3">
                                  Competitor Comparison ({item.competitorTimes.length} team{item.competitorTimes.length !== 1 ? "s" : ""})
                                </h5>
                                <p className="text-xs text-gray-600 mb-3">
                                  Teams ranked by <strong>total time</strong> (includes penalties). Teams with penalties rank lower than teams without penalties, ensuring fair competition ranking.
                                </p>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-xs">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-semibold">Team</th>
                                        <th className="px-3 py-2 text-center font-semibold">Status</th>
                                        <th className="px-3 py-2 text-right font-semibold">Total</th>
                                        <th className="px-3 py-2 text-right font-semibold">Penalty</th>
                                        {item.totalTimeSeconds && (
                                          <th className="px-3 py-2 text-right font-semibold">vs Us</th>
                                        )}
                                        {(item.splitTimes || item.competitorTimes.some(c => c.splitTimes)) && (
                                          <th className="px-3 py-2 text-right text-xs text-gray-500">Split Details</th>
                                        )}
                                        <th className="px-3 py-2"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {/* All teams (Us + Competitors) sorted by fastest total time (includes penalties) */}
                                      {(() => {
                                        const ourTotal = item.totalTimeSeconds || null;
                                        
                                        // Create combined array with "Us" and competitors
                                        const allTeams: Array<{
                                          id: string;
                                          teamName: string;
                                          isUs: boolean;
                                          ran: boolean;
                                          totalTimeSeconds: number | null;
                                          penaltySeconds: number | null;
                                          splitTimes?: Record<string, number> | null;
                                          notes?: string;
                                        }> = [];
                                        
                                        // Add "Us" if we have a time
                                        if (item.totalTimeSeconds) {
                                          allTeams.push({
                                            id: "us",
                                            teamName: "Us",
                                            isUs: true,
                                            ran: true,
                                            totalTimeSeconds: item.totalTimeSeconds,
                                            penaltySeconds: item.penaltySeconds || 0,
                                            splitTimes: item.splitTimes,
                                          });
                                        }
                                        
                                        // Add competitors
                                        (item.competitorTimes || []).forEach((competitor) => {
                                          allTeams.push({
                                            id: competitor.id,
                                            teamName: competitor.teamName,
                                            isUs: false,
                                            ran: competitor.ran,
                                            totalTimeSeconds: competitor.totalTimeSeconds || null,
                                            penaltySeconds: competitor.penaltySeconds || null,
                                            splitTimes: competitor.splitTimes,
                                            notes: competitor.notes,
                                          });
                                        });
                                        
                                        // Sort by: ran status first, then by total time (fastest first)
                                        // Using total time ensures teams with penalties rank lower than teams without penalties
                                        // This is the standard competition ranking method
                                        allTeams.sort((a, b) => {
                                          // Ran teams first
                                          if (a.ran !== b.ran) {
                                            return b.ran ? 1 : -1;
                                          }
                                          // Then by total time (fastest first) - includes penalties
                                          // Teams with penalties will rank lower than teams without penalties
                                          if (a.totalTimeSeconds === null && b.totalTimeSeconds === null) return 0;
                                          if (a.totalTimeSeconds === null) return 1; // No time goes to end
                                          if (b.totalTimeSeconds === null) return -1; // No time goes to end
                                          return a.totalTimeSeconds - b.totalTimeSeconds; // Fastest total time first
                                        });
                                        
                                        return allTeams.map((team) => {
                                          // Compare total times (includes penalties) for "vs Us" column
                                          const diff = ourTotal !== null && team.totalTimeSeconds !== null && !team.isUs
                                            ? team.totalTimeSeconds - ourTotal
                                            : null;
                                          const hasSplitTimes = item.splitTimes || team.splitTimes;
                                          const isFaster = diff !== null && diff < 0;
                                          const isSlower = diff !== null && diff > 0;
                                          
                                          return (
                                            <tr
                                              key={team.id}
                                              className={
                                                team.isUs
                                                  ? "bg-blue-50 font-semibold"
                                                  : !team.ran
                                                  ? "bg-gray-100 opacity-60"
                                                  : isFaster
                                                  ? "bg-green-50"
                                                  : isSlower
                                                  ? "bg-red-50"
                                                  : ""
                                              }
                                            >
                                              <td className={`px-3 py-2 font-medium ${team.isUs ? "text-blue-900" : ""}`}>
                                                {team.teamName}
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                {team.ran ? (
                                                  <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">Ran</span>
                                                ) : (
                                                  <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">Didn't Run</span>
                                                )}
                                              </td>
                                              <td className="px-3 py-2 text-right">
                                                {team.totalTimeSeconds ? formatTime(team.totalTimeSeconds) : "—"}
                                              </td>
                                              <td className="px-3 py-2 text-right text-red-600">
                                                {team.penaltySeconds && team.penaltySeconds > 0 ? `+${formatTime(team.penaltySeconds)}` : "-"}
                                              </td>
                                              {item.totalTimeSeconds && !team.isUs && (
                                                <td className={`px-3 py-2 text-right font-semibold ${isFaster ? "text-green-700" : isSlower ? "text-red-700" : "text-gray-700"}`}>
                                                  {diff !== null ? (
                                                    diff > 0 ? (
                                                      <span className="flex items-center justify-end gap-1">
                                                        <span>+{formatTime(diff)}</span>
                                                        <span className="text-red-600">slower</span>
                                                      </span>
                                                    ) : diff < 0 ? (
                                                      <span className="flex items-center justify-end gap-1">
                                                        <span>{formatTime(Math.abs(diff))}</span>
                                                        <span className="text-green-600">faster</span>
                                                      </span>
                                                    ) : (
                                                      "="
                                                    )
                                                  ) : "-"}
                                                </td>
                                              )}
                                              {item.totalTimeSeconds && team.isUs && (
                                                <td className="px-3 py-2 text-right text-blue-700">—</td>
                                              )}
                                              {hasSplitTimes && (
                                                <td className="px-3 py-2 text-right text-xs text-gray-500">
                                                  {team.splitTimes ? "✓" : "-"}
                                                </td>
                                              )}
                                              <td className="px-3 py-2">
                                                {team.isUs ? (
                                                  <span className="text-xs text-blue-600">You</span>
                                                ) : (
                                                  <div className="flex items-center gap-2">
                                                    <button
                                                      onClick={() => {
                                                        const competitor = item.competitorTimes?.find((c) => c.id === team.id);
                                                        if (competitor) {
                                                          startEditingCompetitor(competitor, item.id);
                                                        }
                                                      }}
                                                      disabled={loadingStates.updatingCompetitor[team.id] || loadingStates.deletingCompetitor[team.id] || editingCompetitorId === team.id}
                                                      className="text-blue-600 hover:text-blue-800 text-xs font-medium disabled:opacity-50"
                                                      title="Edit competitor time"
                                                    >
                                                      ✎
                                                    </button>
                                                    <button
                                                      onClick={() => deleteCompetitorTime(team.id)}
                                                      disabled={loadingStates.updatingCompetitor[team.id] || loadingStates.deletingCompetitor[team.id] || editingCompetitorId === team.id}
                                                      className="text-red-600 hover:text-red-800 text-xs font-bold disabled:opacity-50"
                                                      title="Remove competitor"
                                                    >
                                                      ×
                                                    </button>
                                                  </div>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        });
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                                <p className="text-xs text-gray-500 mt-3 italic">
                                  💡 Green = faster than us, Red = slower than us. Split times are optional.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Display saved times if they exist */}
                      {item.totalTimeSeconds && (
                        <div className="mt-2 text-xs text-gray-500">
                          Saved: {formatTime(item.totalTimeSeconds)} total
                          {item.penaltySeconds && item.penaltySeconds > 0 && (
                            <> (+{formatTime(item.penaltySeconds)} penalty)</>
                          )}
                          {item.splitTimes && Object.keys(item.splitTimes).length > 0 && (
                            <> • Split times recorded</>
                          )}
                        </div>
                      )}
                      {!item.totalTimeSeconds && (
                        <div className="mt-2 text-xs text-gray-400 italic">
                          Enter total time and penalty to save. Split times are optional and can be added later.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Move Up */}
                    <button
                      onClick={() => moveItem(item.id, "up")}
                      disabled={loadingStates.movingItem[item.id] || index === 0}
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
                      disabled={loadingStates.movingItem[item.id] || index === sortedQueue.length - 1}
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
                        disabled={loadingStates.updatingStatus[`status-${item.id}`]}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 touch-manipulation min-h-[32px]"
                      >
                        {loadingStates.updatingStatus[`status-${item.id}`] ? "..." : "Mark Run"}
                      </button>
                    ) : item.status === "RUN" ? (
                      <button
                        onClick={() => updateQueueItem(item.id, { status: "SKIPPED" })}
                        disabled={loadingStates.updatingStatus[`status-${item.id}`]}
                        className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 disabled:opacity-50 touch-manipulation min-h-[32px]"
                      >
                        {loadingStates.updatingStatus[`status-${item.id}`] ? "..." : "Mark Skipped"}
                      </button>
                    ) : (
                      <button
                        onClick={() => updateQueueItem(item.id, { status: "PLANNED" })}
                        disabled={loadingStates.updatingStatus[`status-${item.id}`]}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 touch-manipulation min-h-[32px]"
                      >
                        {loadingStates.updatingStatus[`status-${item.id}`] ? "..." : "Mark Planned"}
                      </button>
                    )}

                    {/* Add Rerun */}
                    <button
                      onClick={() => addRerun(item)}
                      disabled={loadingStates.addingItem}
                      className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50 touch-manipulation min-h-[32px]"
                    >
                      {loadingStates.addingItem ? "..." : "Rerun"}
                    </button>

                    {/* Remove */}
                    <button
                      onClick={() => deleteQueueItem(item.id)}
                      disabled={loadingStates.deletingItem[item.id]}
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

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.type === "danger" ? "Delete" : "Confirm"}
        cancelLabel="Cancel"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        type={confirmDialog.type || "info"}
      />

      {/* Keyboard Help Modal */}
      {showKeyboardHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setShowKeyboardHelp(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">Ctrl/Cmd + S</span>
                <span className="text-gray-600">Save current time entry</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">Ctrl/Cmd + K</span>
                <span className="text-gray-600">Focus custom event input</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">↑ / ↓</span>
                <span className="text-gray-600">Navigate between queue items</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">Enter</span>
                <span className="text-gray-600">Mark current item as RUN</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">Escape</span>
                <span className="text-gray-600">Cancel current action / Close dialogs</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-700">Ctrl/Cmd + A</span>
                <span className="text-gray-600">Select all / Deselect all</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">?</span>
                <span className="text-gray-600">Show this help</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
