import { getSupabaseSession } from "./supabase-public";

const WORKOUT_SESSION_DRAFT_KEY_PREFIX = "workout-session-draft";
const WORKOUT_FAVORITES_KEY_PREFIX = "workout-favorite-movements";
const LAST_COMPLETED_WORKOUT_KEY_PREFIX = "last-completed-workout";
export const WORKOUT_REPEAT_SESSION_KEY = "workout-repeat-session";

function accountStorageKey(prefix: string) {
  const userId = getSupabaseSession()?.user.id;
  return `${prefix}:${userId ?? "signed-out"}`;
}

export function workoutSessionDraftKey() {
  return accountStorageKey(WORKOUT_SESSION_DRAFT_KEY_PREFIX);
}

export function workoutFavoritesKey() {
  return accountStorageKey(WORKOUT_FAVORITES_KEY_PREFIX);
}

export function lastCompletedWorkoutKey() {
  return accountStorageKey(LAST_COMPLETED_WORKOUT_KEY_PREFIX);
}

export type WorkoutLocalSummary = {
  savedAt: string;
  date: string;
  title: string;
  movements: string[];
  loadedSuggestionId: string | null;
  editingSessionId: string | null;
};

function readSummary(value: string | null, completedOnly: boolean): WorkoutLocalSummary | null {
  if (!value) return null;
  try {
    const stored = JSON.parse(value) as {
      version?: unknown;
      savedAt?: unknown;
      sessionId?: unknown;
      loadedSuggestionId?: unknown;
      editingSessionId?: unknown;
      form?: {
        date?: unknown;
        title?: unknown;
        entries?: Array<{ exercise?: unknown }>;
      };
    };
    if (
      stored.version !== 1 ||
      typeof stored.savedAt !== "string" ||
      Number.isNaN(Date.parse(stored.savedAt)) ||
      (completedOnly && (typeof stored.sessionId !== "string" || !stored.sessionId)) ||
      typeof stored.form?.date !== "string" ||
      typeof stored.form.title !== "string" ||
      !Array.isArray(stored.form.entries)
    ) {
      return null;
    }
    const movements = stored.form.entries.flatMap((entry) =>
      typeof entry.exercise === "string" && entry.exercise.trim() ? [entry.exercise.trim()] : [],
    );
    return {
      savedAt: stored.savedAt,
      date: stored.form.date,
      title: stored.form.title,
      movements,
      loadedSuggestionId:
        typeof stored.loadedSuggestionId === "string" ? stored.loadedSuggestionId : null,
      editingSessionId:
        typeof stored.editingSessionId === "string" ? stored.editingSessionId : null,
    };
  } catch {
    return null;
  }
}

export function readWorkoutDraftSummary(value: string | null) {
  return readSummary(value, false);
}

export function readCompletedWorkoutSummary(value: string | null) {
  const summary = readSummary(value, true);
  const today = new Date().toLocaleDateString("en-CA");
  return summary?.date === today ? summary : null;
}
