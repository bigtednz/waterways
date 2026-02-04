/**
 * Offline support utilities for Competition Day
 */

const DB_NAME = "WaterwaysOfflineDB";
const DB_VERSION = 1;
const STORE_NAME = "competitionDayActions";

interface QueuedAction {
  id: string;
  type: "add" | "update" | "delete" | "status" | "times" | "notes" | "move";
  competitionDayId: string;
  data: any;
  timestamp: number;
  retries: number;
}

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
export async function initOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("competitionDayId", "competitionDayId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

/**
 * Queue an action for offline execution
 */
export async function queueAction(
  type: QueuedAction["type"],
  competitionDayId: string,
  data: any
): Promise<string> {
  if (!db) {
    await initOfflineDB();
  }

  const action: QueuedAction = {
    id: crypto.randomUUID(),
    type,
    competitionDayId,
    data,
    timestamp: Date.now(),
    retries: 0,
  };

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(action);

    request.onsuccess = () => resolve(action.id);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all queued actions for a competition day
 */
export async function getQueuedActions(competitionDayId: string): Promise<QueuedAction[]> {
  if (!db) {
    await initOfflineDB();
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("competitionDayId");
    const request = index.getAll(competitionDayId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove a queued action after successful sync
 */
export async function removeQueuedAction(actionId: string): Promise<void> {
  if (!db) {
    await initOfflineDB();
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(actionId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if browser is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Listen for online/offline events
 */
export function onOnlineStatusChange(callback: (isOnline: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

/**
 * Sync queued actions when coming back online
 */
export async function syncQueuedActions(
  competitionDayId: string,
  apiCall: (action: QueuedAction) => Promise<void>
): Promise<{ success: number; failed: number }> {
  const actions = await getQueuedActions(competitionDayId);
  let success = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      await apiCall(action);
      await removeQueuedAction(action.id);
      success++;
    } catch (error) {
      console.error("Failed to sync action:", action, error);
      failed++;
    }
  }

  return { success, failed };
}
