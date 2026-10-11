import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import {
  flushQueuedWorkoutSaves,
  hasLegacyWorkoutSaves,
  pendingWorkoutSaves,
  subscribeToWorkoutSaveQueue,
} from "@/lib/workout-offline-queue";

export function WorkoutSyncStatus() {
  const client = useQueryClient();
  const [pending, setPending] = useState(pendingWorkoutSaves);
  const [syncing, setSyncing] = useState(false);
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let previousCount = pendingWorkoutSaves().length;
    return subscribeToWorkoutSaveQueue(() => {
      const next = pendingWorkoutSaves();
      setPending(next);
      if (next.length < previousCount) void client.invalidateQueries();
      previousCount = next.length;
    });
  }, [client]);

  useEffect(() => {
    const connection = () => setOffline(!navigator.onLine);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    return () => {
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, []);
  if (!pending.length && !offline && !hasLegacyWorkoutSaves()) return null;
  return (
    <div role="status" className="mb-4 rounded-xl border border-border bg-muted/30 p-3 text-sm">
      {pending.length ? (
        <p>
          {pending.length} workout{pending.length === 1 ? "" : "s"} saved on this device, awaiting
          sync.
        </p>
      ) : null}
      {offline ? <p>Offline. Your drafts and pending workouts stay on this device.</p> : null}
      {hasLegacyWorkoutSaves() ? (
        <p>Older pending saves need review in Log before retrying. Their saved drafts are kept.</p>
      ) : null}
      {pending.find((item) => item.lastError)?.lastError || error ? (
        <p className="mt-1 text-destructive">
          {pending.find((item) => item.lastError)?.lastError ?? error}
        </p>
      ) : null}
      {pending.length ? (
        <Button
          className="mt-2"
          variant="outline"
          size="sm"
          disabled={syncing || offline}
          onClick={async () => {
            setSyncing(true);
            setError(null);
            try {
              await flushQueuedWorkoutSaves();
            } catch {
              setError(
                "Sync was interrupted. Your pending workouts are kept; retry when connected.",
              );
            } finally {
              setSyncing(false);
              setPending(pendingWorkoutSaves());
            }
          }}
        >
          {syncing ? "Syncing…" : "Retry sync"}
        </Button>
      ) : null}
    </div>
  );
}
