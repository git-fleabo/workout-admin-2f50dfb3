import { getSupabaseSession, supabasePublicRpc } from "./supabase-public";

const QUEUE_KEY = "workout-save-queue";
const QUEUE_EVENT = "workout-save-queue-updated";

type QueuedWorkoutSave = {
  id: string;
  createdAt: string;
  personId: string;
  rpcBody: Record<string, unknown>;
  draftKey: string;
  draftSnapshot: string | null;
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readQueue(): QueuedWorkoutSave[] {
  if (!canUseStorage()) return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is QueuedWorkoutSave => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<QueuedWorkoutSave>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.createdAt === "string" &&
        typeof candidate.personId === "string" &&
        typeof candidate.rpcBody === "object" &&
        candidate.rpcBody !== null &&
        typeof candidate.draftKey === "string" &&
        (candidate.draftSnapshot === null || typeof candidate.draftSnapshot === "string")
      );
    });
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedWorkoutSave[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

function queueId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function queuedWorkoutSaveCount() {
  return readQueue().length;
}

export function isLikelyOfflineError(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof TypeError) return true;
  return (
    error instanceof Error && /failed to fetch|network|offline|connection/i.test(error.message)
  );
}

export function enqueueWorkoutSave({
  personId,
  rpcBody,
  draftKey,
}: {
  personId: string;
  rpcBody: Record<string, unknown>;
  draftKey: string;
}) {
  const draftSnapshot = canUseStorage() ? window.localStorage.getItem(draftKey) : null;
  const item: QueuedWorkoutSave = {
    id: queueId(),
    createdAt: new Date().toISOString(),
    personId,
    rpcBody,
    draftKey,
    draftSnapshot,
  };
  writeQueue([...readQueue(), item]);
  return item;
}

export async function flushQueuedWorkoutSaves() {
  const session = getSupabaseSession();
  if (!session?.user.id || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return queuedWorkoutSaveCount();
  }

  const queue = readQueue();
  const remaining: QueuedWorkoutSave[] = [];
  for (const item of queue) {
    if (item.personId !== session.user.id) {
      remaining.push(item);
      continue;
    }
    try {
      const sessionId = await supabasePublicRpc<string>("save_workout", item.rpcBody);
      if (!sessionId) throw new Error("Workout was not saved.");
      if (canUseStorage() && window.localStorage.getItem(item.draftKey) === item.draftSnapshot) {
        window.localStorage.removeItem(item.draftKey);
      }
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        remaining.push(item);
        break;
      }
      console.error("Queued workout save failed", error);
    }
  }
  writeQueue(remaining);
  return remaining.length;
}

export function subscribeToWorkoutSaveQueue(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handleUpdate = () => listener();
  window.addEventListener(QUEUE_EVENT, handleUpdate);
  return () => window.removeEventListener(QUEUE_EVENT, handleUpdate);
}
