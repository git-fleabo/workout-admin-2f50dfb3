import {
  SUPABASE_SESSION_EVENT,
  getSupabaseSession,
  isTransientSupabaseError,
  SupabaseAuthRequiredError,
  SupabaseRequestError,
  supabasePublicRpc,
} from "./supabase-public";
import { getCurrentPerson } from "./supabase-people.browser";
import { withBrowserLock } from "./browser-lock";
import type { WorkoutSessionInput } from "./supabase-log.browser";

const QUEUE_PREFIX = "workout-save-operation:";
const LEGACY_QUEUE_KEY = "workout-save-queue";
const QUEUE_EVENT = "workout-save-queue-updated";

export class PendingWorkoutSaveError extends Error {}

export type QueuedWorkoutSave = {
  id: string;
  userId: string;
  createdAt: string;
  personId: string;
  input?: WorkoutSessionInput;
  rpcBody?: Record<string, unknown>;
  draftKey: string;
  draftSnapshot: string | null;
  lastError?: string;
};

function readQueue(): QueuedWorkoutSave[] {
  if (typeof window === "undefined") return [];
  const userId = getSupabaseSession()?.user.id;
  const items: QueuedWorkoutSave[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(QUEUE_PREFIX)) continue;
    try {
      const item = JSON.parse(window.localStorage.getItem(key) ?? "null") as QueuedWorkoutSave;
      if (
        item?.userId === userId &&
        typeof item.id === "string" &&
        item.id &&
        typeof item.createdAt === "string" &&
        !Number.isNaN(Date.parse(item.createdAt)) &&
        typeof item.personId === "string" &&
        item.personId &&
        typeof item.draftKey === "string" &&
        item.draftKey &&
        (item.draftSnapshot === null || typeof item.draftSnapshot === "string") &&
        (item.input || item.rpcBody)
      )
        items.push(item);
    } catch {
      /* Keep unreadable records for recovery; never send them. */
    }
  }
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

function changed() {
  window.dispatchEvent(new Event(QUEUE_EVENT));
}
function writeItem(item: QueuedWorkoutSave) {
  window.localStorage.setItem(QUEUE_PREFIX + item.id, JSON.stringify(item));
  changed();
}
export function pendingWorkoutSaves() {
  return readQueue();
}
export function queuedWorkoutSaveCount() {
  return readQueue().length;
}
export function hasLegacyWorkoutSaves() {
  try {
    return JSON.parse(window.localStorage.getItem(LEGACY_QUEUE_KEY) ?? "[]").length > 0;
  } catch {
    return false;
  }
}

export function isLikelyOfflineError(error: unknown) {
  return isTransientSupabaseError(error);
}

export function enqueueWorkoutSave({
  personId,
  input,
  rpcBody,
  draftKey,
}: {
  personId: string;
  input?: WorkoutSessionInput;
  rpcBody?: Record<string, unknown>;
  draftKey: string;
}) {
  const userId = getSupabaseSession()?.user.id;
  if (!userId) throw new SupabaseAuthRequiredError("Sign in before saving; your draft is kept.");
  const existing = readQueue().find(
    (item) =>
      item.personId === personId &&
      item.draftKey === draftKey &&
      JSON.stringify(item.input ?? item.rpcBody) === JSON.stringify(input ?? rpcBody),
  );
  if (existing) return existing;
  const item: QueuedWorkoutSave = {
    id: crypto.randomUUID(),
    userId,
    personId,
    input,
    rpcBody,
    draftKey,
    createdAt: new Date().toISOString(),
    draftSnapshot: window.localStorage.getItem(draftKey),
  };
  try {
    writeItem(item);
  } catch {
    throw new Error(
      "This device could not retain the workout. Keep the draft and free storage before saving.",
    );
  }
  return item;
}

export function sendQueuedWorkoutSave(item: QueuedWorkoutSave) {
  return withBrowserLock(`train-track-workout-operation:${item.userId}:${item.id}`, async () => {
    // Re-read under the tab lock so direct finishes and background sync use the
    // same frozen payload, even when references change while preparation awaits.
    const current = window.localStorage.getItem(QUEUE_PREFIX + item.id);
    if (current) item = JSON.parse(current) as QueuedWorkoutSave;
    return sendOperation(item);
  });
}

async function sendOperation(item: QueuedWorkoutSave) {
  if (getSupabaseSession()?.user.id !== item.userId)
    throw new SupabaseAuthRequiredError("Sign in to the account that saved this workout.");
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
  const person = await getCurrentPerson();
  if (person?.id !== item.personId)
    throw new Error("This pending workout belongs to a different training profile.");
  if (!item.rpcBody) {
    const { prepareQueuedWorkoutSave } = await import("./supabase-log.browser");
    item = { ...item, rpcBody: await prepareQueuedWorkoutSave(item.input!, item.personId) };
    // Freeze validated references before the first request: retries use precisely
    // the same payload even if the library changes or the response is lost.
    writeItem(item);
  }
  let sessionId: string;
  try {
    sessionId = await supabasePublicRpc<string>("save_workout_once", {
      ...item.rpcBody,
      p_operation_id: item.id,
    });
  } catch (error) {
    if (error instanceof SupabaseRequestError && error.status < 500 && error.status !== 429)
      throw error;
    throw new PendingWorkoutSaveError(
      "The save was not confirmed. It is kept on this device for retry.",
    );
  }
  if (typeof sessionId !== "string" || !sessionId)
    throw new PendingWorkoutSaveError("The save was not confirmed. Retry sync.");
  if (getSupabaseSession()?.user.id !== item.userId)
    throw new SupabaseAuthRequiredError(
      "Your sign-in changed. Retry sync with the original account.",
    );
  try {
    if (window.localStorage.getItem(item.draftKey) === item.draftSnapshot)
      window.localStorage.removeItem(item.draftKey);
    window.localStorage.removeItem(QUEUE_PREFIX + item.id);
  } catch {
    // A confirmed server save remains confirmed even if local cleanup fails.
    // The retained operation can replay safely when storage becomes available.
  }
  changed();
  return sessionId;
}

export function removeQueuedWorkoutSave(id: string) {
  window.localStorage.removeItem(QUEUE_PREFIX + id);
  changed();
}

let flushing: Promise<number> | null = null;
export function flushQueuedWorkoutSaves(): Promise<number> {
  if (flushing) return flushing;
  flushing = withBrowserLock("train-track-workout-sync", async () => {
    if (!getSupabaseSession() || !navigator.onLine) return queuedWorkoutSaveCount();
    for (const item of readQueue()) {
      // Another tab may already have confirmed this operation.
      if (!window.localStorage.getItem(QUEUE_PREFIX + item.id)) continue;
      try {
        await sendQueuedWorkoutSave(item);
      } catch (error) {
        // Update only this operation, never a stale snapshot of the entire queue.
        // A failure in another tab cannot resurrect an already confirmed save.
        const current = window.localStorage.getItem(QUEUE_PREFIX + item.id);
        if (current)
          writeItem({
            ...JSON.parse(current),
            lastError: error instanceof Error ? error.message : "Retry sync.",
          });
        break;
      }
    }
    return queuedWorkoutSaveCount();
  });
  const work = flushing;
  void work
    .finally(() => {
      if (flushing === work) flushing = null;
    })
    .catch(() => undefined);
  return work;
}

export function subscribeToWorkoutSaveQueue(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const storage = (event: StorageEvent) => {
    if (event.key?.startsWith(QUEUE_PREFIX) || event.key === "supabase-session") listener();
  };
  window.addEventListener(SUPABASE_SESSION_EVENT, listener);
  window.addEventListener(QUEUE_EVENT, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(SUPABASE_SESSION_EVENT, listener);
    window.removeEventListener(QUEUE_EVENT, listener);
    window.removeEventListener("storage", storage);
  };
}
