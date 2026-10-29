import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecoveryField } from "./recovery-editor";
import {
  recoveryDraftKey,
  actualSummary,
  comparableExercise,
  emptyActuals,
  type RecoverySession,
  type RecoveryActual,
} from "@/lib/recovery";
import { formatUKDate } from "@/lib/date";
import { saveRecoverySessionClient } from "@/lib/supabase-recovery.browser";
const inputClass = "w-full min-w-0 rounded-md border border-input bg-background p-2 text-sm";

type Draft = {
  actuals: RecoveryActual[];
  pain: number | null;
  notes: string;
  check_enabled: boolean;
};
function initialDraft(session: RecoverySession): Draft {
  let stored: { version?: number; data?: Draft } | null = null;
  try {
    stored = JSON.parse(localStorage.getItem(recoveryDraftKey(session)) || "null");
  } catch {
    /* Server draft remains available. */
  }
  if (stored?.version === session.version && stored.data && Array.isArray(stored.data.actuals))
    return stored.data;
  return {
    actuals: emptyActuals(session.snapshot).map(
      (blank) =>
        session.actuals.find(
          (a) => a.exerciseId === blank.exerciseId && a.side === blank.side && a.set === blank.set,
        ) ?? blank,
    ),
    pain: session.pain,
    notes: session.notes,
    check_enabled: session.check_enabled,
  };
}
export function RecoveryLogger({
  session,
  history,
  onSaved,
}: {
  session: RecoverySession;
  history: RecoverySession[];
  onSaved: (session: RecoverySession) => void;
}) {
  const [draft, setDraft] = useState(() => initialDraft(session));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localWarning, setLocalWarning] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(
        recoveryDraftKey(session),
        JSON.stringify({ version: session.version, data: draft }),
      );
      setLocalWarning(false);
    } catch {
      setLocalWarning(true);
    }
  }, [draft, session]);
  async function save(status: RecoverySession["status"]) {
    if (busy) return;
    if (
      status === "cancelled" &&
      !window.confirm(
        "Cancel this unfinished recovery session? Its entered results will be discarded.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const saved = await saveRecoverySessionClient(session, draft, status);
      try {
        localStorage.removeItem(recoveryDraftKey(session));
      } catch {
        /* server result is authoritative */
      }
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Your entries are still here.");
    } finally {
      setBusy(false);
    }
  }
  function actual(index: number, patch: Partial<RecoveryActual>) {
    setDraft({
      ...draft,
      actuals: draft.actuals.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    });
  }
  return (
    <section className="space-y-5" aria-label="Recovery logger">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {session.routine_name} · {formatUKDate(session.session_date)}
        </p>
        <h2 className="text-2xl font-semibold">{session.snapshot.name}</h2>
        <p className="text-sm text-muted-foreground">
          {session.snapshot.mode === "quick"
            ? "Quick practice · completion only, no invented set results."
            : "Record actual work below. Blank fields stay unknown."}
        </p>
      </header>
      {session.snapshot.notes && (
        <p className="whitespace-pre-wrap text-sm">{session.snapshot.notes}</p>
      )}
      {session.snapshot.exercises.map((exercise) => {
        const prior = history.find(
          (s) =>
            s.id !== session.id &&
            s.status === "completed" &&
            s.session_date <= session.session_date &&
            s.routine_id === session.routine_id &&
            s.legacy_run_id === session.legacy_run_id &&
            s.snapshot.exercises.some((e) => comparableExercise(e, exercise)) &&
            s.actuals.some((a) => a.exerciseId === exercise.id),
        );
        return (
          <article
            key={exercise.id}
            className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4"
          >
            <h3 className="font-semibold">{exercise.name}</h3>
            {(session.snapshot.mode === "measured" ||
              exercise.sets > 1 ||
              exercise.reps ||
              exercise.weight !== null ||
              exercise.hold !== null) && (
              <p className="text-sm text-muted-foreground">
                Target: {exercise.sets} sets{exercise.reps && ` · ${exercise.reps} reps`}
                {exercise.weight !== null &&
                  ` · ${exercise.weight} kg (${exercise.load.replace("_", " ")})`}
                {exercise.hold !== null && ` · ${exercise.hold}s`}
                {exercise.side !== "none" && ` · ${exercise.side}`}
              </p>
            )}
            {exercise.setup && (
              <p className="whitespace-pre-wrap text-sm">Setup target: {exercise.setup}</p>
            )}
            {exercise.source && /^https?:\/\//i.test(exercise.source) && (
              <a
                className="text-sm text-primary underline"
                href={exercise.source}
                target="_blank"
                rel="noreferrer"
              >
                Source / lesson ↗
              </a>
            )}
            {session.snapshot.mode === "measured" && (
              <>
                <div className="rounded-lg bg-muted/40 p-3 text-xs">
                  <p className="font-medium">Previous actual results · same saved setup</p>
                  {prior ? (
                    <>
                      <p>{formatUKDate(prior.session_date)}</p>
                      {prior.actuals
                        .filter((a) => a.exerciseId === exercise.id)
                        .map((a) => (
                          <p key={`${a.side}-${a.set}`}>{actualSummary(a, exercise.load)}</p>
                        ))}
                    </>
                  ) : (
                    <p>No comparable results recorded yet.</p>
                  )}
                  <p className="mt-1 text-muted-foreground">
                    Compare range and technique too; more weight alone does not establish progress.
                  </p>
                </div>
                {draft.actuals.map((a, index) =>
                  a.exerciseId !== exercise.id ? null : (
                    <fieldset
                      key={`${a.side}-${a.set}`}
                      className="min-w-0 space-y-2 border-t pt-3"
                    >
                      <legend className="text-sm font-medium">
                        Actual set {a.set}
                        {a.side !== "none" && ` · ${a.side}`}
                      </legend>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            ["reps", "Reps"],
                            ["weight", exercise.load === "per_hand" ? "kg / hand" : "kg"],
                            ["hold", "Hold (s)"],
                          ] as const
                        ).map(([key, label]) => (
                          <RecoveryField key={key} label={label}>
                            <Input
                              aria-label={`${exercise.name} ${a.side} set ${a.set} ${label}`}
                              type="number"
                              min="0"
                              step={key === "weight" ? "1.25" : "any"}
                              value={a[key] ?? ""}
                              placeholder="—"
                              onChange={(e) =>
                                actual(index, {
                                  [key]: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                            />
                          </RecoveryField>
                        ))}
                      </div>
                      <details>
                        <summary className="cursor-pointer text-xs">
                          Range / measurement and technique
                        </summary>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <RecoveryField label="Actual range / measurement (include units)">
                            <Input
                              value={a.range}
                              onChange={(e) => actual(index, { range: e.target.value })}
                              placeholder="e.g. 70°, 12 cm, comfortable range"
                            />
                          </RecoveryField>
                          <RecoveryField label="Actual technique / setup notes">
                            <Input
                              value={a.technique}
                              onChange={(e) => actual(index, { technique: e.target.value })}
                            />
                          </RecoveryField>
                        </div>
                      </details>
                    </fieldset>
                  ),
                )}
              </>
            )}
          </article>
        );
      })}
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Optional symptoms and notes
        </summary>
        <div className="mt-3 space-y-3">
          <RecoveryField label="Discomfort / pain during session (0–10, optional)">
            <Input
              type="number"
              min="0"
              max="10"
              step="any"
              value={draft.pain ?? ""}
              placeholder="Not recorded"
              onChange={(e) =>
                setDraft({ ...draft, pain: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </RecoveryField>
          <RecoveryField label="Session notes">
            <textarea
              className={inputClass}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </RecoveryField>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.check_enabled}
              onChange={(e) => setDraft({ ...draft, check_enabled: e.target.checked })}
            />
            Offer a next-morning check here
          </label>
        </div>
      </details>
      {session.snapshot.progression && (
        <details>
          <summary className="cursor-pointer text-sm">Your progression instructions</summary>
          <p className="whitespace-pre-wrap pt-2 text-sm">{session.snapshot.progression}</p>
        </details>
      )}
      {localWarning && (
        <p role="status" className="text-sm">
          This browser cannot retain local changes. Use Save and close before leaving.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => save("completed")}>
          {busy
            ? "Saving…"
            : session.snapshot.mode === "quick"
              ? "Complete practice"
              : "Save completed session"}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => save("draft")}>
          Save and close
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => save("cancelled")}>
          Cancel session
        </Button>
      </div>
    </section>
  );
}
