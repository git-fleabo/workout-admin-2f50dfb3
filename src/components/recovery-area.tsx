import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RecoveryEditor } from "./recovery-editor";
import { RecoveryLogger } from "./recovery-logger";
import { ToolkitResources } from "./recovery-toolkit";
import {
  actualSummary,
  recoveryProgress,
  blankRoutine,
  legacyName,
  legacyTemplate,
  nextScheduledDate,
  templateDue,
  WEEKDAYS,
  type RecoveryRoutine,
  type RecoveryRoutineInput,
  type RecoverySession,
  type RecoveryTemplate,
} from "@/lib/recovery";
import {
  classifyLegacyRecoveryClient,
  listRecoveryClient,
  saveRecoveryResponseClient,
  saveRecoveryRoutineClient,
  saveRecoverySessionClient,
  startRecoveryClient,
} from "@/lib/supabase-recovery.browser";
import { listMobilityDataClient } from "@/lib/supabase-mobility.browser";
import { formatUKDate, todayISO } from "@/lib/date";

export function RecoveryArea({ requestedSessionId }: { requestedSessionId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const today = todayISO();
  const data = useQuery({ queryKey: ["recovery"], queryFn: listRecoveryClient });
  const legacy = useQuery({ queryKey: ["mobility-practice"], queryFn: listMobilityDataClient });
  const [editor, setEditor] = useState<{
    initial: RecoveryRoutineInput;
    previous?: RecoveryRoutine;
  } | null>(null);
  const [resources, setResources] = useState(false);
  const [inactive, setInactive] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestedSession, setRequestedSession] = useState<RecoverySession | null>(null);
  useEffect(() => {
    if (!requestedSessionId) setRequestedSession(null);
  }, [requestedSessionId]);
  const sessions = data.data?.sessions ?? [];
  const session = requestedSessionId
    ? requestedSession?.id === requestedSessionId
      ? requestedSession
      : sessions.find((s) => s.id === requestedSessionId)
    : null;
  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["recovery"] }),
      qc.invalidateQueries({ queryKey: ["mobility-practice"] }),
      qc.invalidateQueries({ queryKey: ["next-suggested-workouts"] }),
    ]);
  }
  async function operation(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The change could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  async function start(
    id: string,
    templateId: string,
    isLegacy: boolean,
    scheduleId?: string,
    skip = false,
  ) {
    await operation(async () => {
      let started = await startRecoveryClient(id, templateId, isLegacy, scheduleId);
      if (skip) {
        if (started.status !== "draft") return;
        // Do not discard an existing draft through a schedule shortcut.
        if (
          started.actuals.length ||
          localStorage.getItem(`tt:recovery:${started.person_id}:${started.id}`)
        )
          throw new Error("Resume the unfinished session to save or cancel it before skipping.");
        started = await saveRecoverySessionClient(
          started,
          { actuals: [], pain: null, notes: "", check_enabled: false },
          "skipped",
        );
      } else if (started.status === "draft") {
        setRequestedSession(started);
        await navigate({ to: "/mobility", search: { session: started.id } });
      }
      await refresh();
    });
  }
  function routineCard(
    id: string,
    name: string,
    status: string,
    templates: RecoveryTemplate[],
    isLegacy = false,
    routine?: RecoveryRoutine,
  ) {
    const own = sessions.filter((s) => s.routine_id === id || s.legacy_run_id === id);
    const latest = own.find((s) => s.status === "completed");
    const legacyLast = legacy.data?.sessions.find((s) => s.runId === id);
    const last = [latest?.session_date, legacyLast?.date].filter(Boolean).sort().at(-1);
    const schedules =
      data.data?.schedules.filter(
        (s) => s.mobility_practice_run_id === id && (!s.suggested_for || s.suggested_for >= today),
      ) ?? [];
    return (
      <article
        key={id}
        className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold">{name}</h2>
            <p className="text-xs text-muted-foreground">
              {routine?.purpose && `${routine.purpose} · `}
              {routine?.area && `${routine.area} · `}
              {status}
              {isLegacy && " · Toolkit practice"}
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              routine ? setEditor({ initial: routine, previous: routine }) : setResources(true)
            }
          >
            {isLegacy ? "Edit / resources" : "Edit routine"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {last ? `Last completed ${formatUKDate(last)}` : "No completions recorded"}
        </p>
        {templates.map((t) => {
          const draft = own.find((s) => s.template_id === t.id && s.status === "draft");
          const due = templateDue(t, status as RecoveryRoutineInput["status"], id, sessions, today);
          const done = own.some(
            (s) =>
              s.template_id === t.id &&
              s.session_date === today &&
              ["completed", "skipped"].includes(s.status),
          );
          const next = nextScheduledDate(t, today);
          const scheduled = schedules[0];
          return (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t pt-3"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-medium">{t.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {due || scheduled?.suggested_for === today
                    ? "Due today"
                    : done
                      ? "Done for today"
                      : scheduled?.suggested_for
                        ? `Scheduled ${formatUKDate(scheduled.suggested_for)}`
                        : next
                          ? `Next ${formatUKDate(next)}`
                          : "Manual · start when useful"}{" "}
                  · about {t.minutes} min
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.mode === "quick" ? "Quick practice" : "Measured session"}
                  {t.weekdays.length ? ` · ${t.weekdays.map((d) => WEEKDAYS[d]).join(", ")}` : ""}
                </p>
              </div>
              {draft ? (
                <Button
                  disabled={busy}
                  onClick={() => navigate({ to: "/mobility", search: { session: draft.id } })}
                >
                  Resume
                </Button>
              ) : ["active", "maintenance"].includes(status) && t.exercises.length > 0 ? (
                <div className="flex gap-2">
                  <Button
                    disabled={busy}
                    variant={done ? "outline" : "default"}
                    onClick={() => start(id, t.id, isLegacy, scheduled?.id)}
                  >
                    {done ? "Log another" : "Start"}
                  </Button>
                  {(due || scheduled?.suggested_for === today) && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => start(id, t.id, isLegacy, scheduled?.id, true)}
                    >
                      Skip today
                    </Button>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {!t.exercises.length ? "Add exercises to start" : "Resume the routine to start"}
                </span>
              )}
            </div>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setHistoryId(historyId === id ? null : id)}
        >
          History & progress
        </Button>
        {historyId === id && (
          <RecoveryHistory
            sessions={own}
            legacySessions={legacy.data?.sessions.filter((s) => s.runId === id) ?? []}
            onClassify={(sessionId, recoveryOnly) =>
              operation(async () => {
                await classifyLegacyRecoveryClient(sessionId, recoveryOnly);
                await qc.invalidateQueries();
              })
            }
            busy={busy}
            onResponseSaved={refresh}
          />
        )}
      </article>
    );
  }
  const active =
    data.data?.routines
      .filter((r) => inactive || ["active", "maintenance"].includes(r.status))
      .sort((a, b) => {
        const priority = (r: RecoveryRoutine) =>
          sessions.some((s) => s.routine_id === r.id && s.status === "draft")
            ? 2
            : r.templates.some((t) => templateDue(t, r.status, r.id, sessions, today))
              ? 1
              : 0;
        return priority(b) - priority(a);
      }) ?? [];
  const oldRuns = legacy.data?.runs.filter((r) => inactive || r.status === "active") ?? [];
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="space-y-2 border-b pb-4">
        <h1 className="page-title">Mobility &amp; Recovery</h1>
        <p className="text-sm text-muted-foreground">
          Your routines, at your pace. Keep practice and progress together.
        </p>
      </header>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {data.error && (
        <p role="alert" className="text-sm text-destructive">
          Recovery could not be loaded. {(data.error as Error).message} Existing toolkit resources
          remain below.
        </p>
      )}
      {session?.status === "draft" ? (
        <RecoveryLogger
          key={session.id}
          session={session}
          history={sessions}
          onSaved={async () => {
            setRequestedSession(null);
            await navigate({ to: "/mobility", search: {} });
            await refresh();
          }}
        />
      ) : editor ? (
        <RecoveryEditor
          initial={editor.initial}
          saving={busy}
          onSave={(input) =>
            operation(async () => {
              await saveRecoveryRoutineClient(input, editor.previous);
              setEditor(null);
              await refresh();
            })
          }
          onCancel={() => setEditor(null)}
        />
      ) : (
        <>
          {requestedSessionId && !data.isLoading && !data.error && (
            <p role="status" className="text-sm">
              {session
                ? "This session is already closed. Find it in History & progress."
                : "This session is not available for your profile."}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!!data.error || data.isLoading}
              onClick={() => setEditor({ initial: blankRoutine() })}
            >
              Create routine
            </Button>
            <Button variant="outline" onClick={() => setResources(!resources)}>
              {resources ? "Hide resources" : "Exercises & source material"}
            </Button>
            <Button variant="ghost" onClick={() => setInactive(!inactive)}>
              {inactive ? "Active routines" : "Paused & archived"}
            </Button>
          </div>
          {sessions
            .filter(
              (s) =>
                s.status === "completed" &&
                s.check_enabled &&
                s.response === null &&
                s.session_date < today,
            )
            .map((s) => (
              <ResponseCheck key={s.id} session={s} onSaved={refresh} />
            ))}
          {data.isLoading && <p>Loading routines…</p>}
          {!data.isLoading && !data.error && active.length === 0 && oldRuns.length === 0 && (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              Create a routine with a short daily practice, a measured session, or both. Choose
              exercises freely and set the days that suit you.
            </p>
          )}
          {active.map((r) => routineCard(r.id, r.name, r.status, r.templates, false, r))}
          {legacy.error && (
            <p className="text-sm text-destructive">
              Existing toolkit practices could not be loaded. Refresh to try again.
            </p>
          )}
          {oldRuns.map((r) =>
            routineCard(
              r.id,
              legacyName(r),
              r.status,
              [legacyTemplate(r, legacy.data?.drills ?? [])],
              true,
            ),
          )}
          {resources && (
            <div className="space-y-4 border-t pt-4">
              <Button asChild variant="outline">
                <Link to="/library">Browse full exercise library</Link>
              </Button>
              <ToolkitResources />
            </div>
          )}
          <details className="border-t pt-3 text-sm">
            <summary className="cursor-pointer">History & progress · all recovery sessions</summary>
            <div className="mt-3">
              <RecoveryHistory
                sessions={sessions}
                onResponseSaved={refresh}
                legacySessions={[]}
                busy={busy}
                onClassify={async () => {}}
              />
            </div>
          </details>
          <TodayShortcutPreference />
        </>
      )}
    </div>
  );
}

function ResponseCheck({
  session,
  onSaved,
  later = false,
}: {
  later?: boolean;
  session: RecoverySession;
  onSaved: () => Promise<void>;
}) {
  const [notes, setNotes] = useState(session.response_notes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="space-y-2 rounded-lg border border-primary/25 p-3">
      <h3 className="text-sm font-semibold">
        {later ? "Later response" : "Next-morning check"} · {session.routine_name}
      </h3>
      <p className="text-xs text-muted-foreground">
        After {session.snapshot.name}, {formatUKDate(session.session_date)}. How did it respond?
        Unanswered stays unknown.
      </p>
      <input
        className="w-full rounded border bg-background p-2 text-sm"
        aria-label="Response notes"
        placeholder="Optional notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {(["better", "same", "worse"] as const).map((response) => (
          <Button
            key={response}
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await saveRecoveryResponseClient(session, response, notes);
                await onSaved();
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {response[0].toUpperCase() + response.slice(1)}
          </Button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
function RecoveryHistory({
  sessions,
  legacySessions,
  onClassify,
  onResponseSaved,
  busy,
}: {
  sessions: RecoverySession[];
  legacySessions: Awaited<ReturnType<typeof listMobilityDataClient>>["sessions"];
  onClassify: (id: string, recovery: boolean) => Promise<void>;
  onResponseSaved: () => Promise<void>;
  busy: boolean;
}) {
  const [visible, setVisible] = useState(20);
  const progress = recoveryProgress(sessions);
  const closed = sessions.filter((s) => s.status !== "draft" && s.status !== "cancelled");
  return (
    <div className="space-y-3 text-sm">
      <p>
        {closed.filter((s) => s.status === "completed").length} completed recovery sessions ·{" "}
        {legacySessions.length} linked legacy records
      </p>
      <p className="text-xs text-muted-foreground">
        Actual results are shown with their saved targets, side, load meaning and setup. Compare
        range and technique before interpreting a change.
      </p>
      {progress.length > 0 && (
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer font-medium">
            Compare recorded results by exercise and setup
          </summary>
          <div className="mt-3 space-y-4">
            {progress.map((group) => (
              <section key={group.key} className="min-w-0 space-y-1">
                <h4 className="font-semibold">
                  {group.name}
                  {group.side !== "none" && ` · ${group.side}`} · {group.load.replace("_", " ")}
                </h4>
                <p className="break-words text-xs text-muted-foreground">
                  {group.setup || "Setup not specified"} · range: {group.range || "unknown"} ·
                  technique: {group.technique || "unknown"}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr>
                        <th className="py-2">Date</th>
                        <th>Set</th>
                        <th>Reps</th>
                        <th>kg{group.load === "per_hand" ? "/hand" : ""}</th>
                        <th>Hold (s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.slice(0, visible).map((row) => (
                        <tr key={`${row.sessionId}-${row.actual.set}`} className="border-t">
                          <td className="py-2 pr-2">{formatUKDate(row.date)}</td>
                          <td>{row.actual.set}</td>
                          <td>{row.actual.reps ?? "—"}</td>
                          <td>{row.actual.weight ?? "—"}</td>
                          <td>{row.actual.hold ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </details>
      )}
      {closed.slice(0, visible).map((s) => (
        <details key={s.id} className="rounded-lg border p-3">
          <summary className="cursor-pointer">
            {formatUKDate(s.session_date)} · {s.routine_name} · {s.snapshot.name} · {s.status}
          </summary>
          <div className="mt-3 space-y-2">
            <p>
              Discomfort: {s.pain ?? "not recorded"} · Later response: {s.response ?? "unknown"}
            </p>
            {s.notes && <p className="whitespace-pre-wrap">{s.notes}</p>}
            {s.response_notes && <p>Response notes: {s.response_notes}</p>}
            {s.status === "completed" && (
              <details>
                <summary className="cursor-pointer text-xs">
                  {s.response ? "Edit response" : "Add a later response (optional)"}
                </summary>
                <ResponseCheck session={s} later onSaved={onResponseSaved} />
              </details>
            )}
            {s.snapshot.mode === "quick" ? (
              <p>Completion only · no set results recorded.</p>
            ) : (
              s.snapshot.exercises.map((e) => (
                <div key={e.id}>
                  <strong>
                    {e.name} · {e.load.replace("_", " ")}
                  </strong>
                  <p className="text-xs text-muted-foreground">
                    Target: {e.sets} sets · {e.reps || "reps unspecified"}
                    {e.weight !== null && ` · ${e.weight} kg`}
                    {e.hold !== null && ` · ${e.hold}s`} · {e.setup || "setup not specified"}
                  </p>
                  {s.actuals
                    .filter((a) => a.exerciseId === e.id)
                    .map((a) => (
                      <p key={`${a.side}-${a.set}`}>{actualSummary(a, e.load)}</p>
                    ))}
                </div>
              ))
            )}
          </div>
        </details>
      ))}
      {closed.length > visible && (
        <Button variant="ghost" onClick={() => setVisible(visible + 20)}>
          Show more history
        </Button>
      )}
      {legacySessions.map((s) => (
        <div key={s.id} className="space-y-2 rounded-lg border p-3">
          <p>
            {formatUKDate(s.date)} · {s.title}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/history" search={{ session: s.id }}>
              Review original workout
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            {s.recoveryOnly
              ? "Classified as recovery only. Original results are preserved."
              : "Classification unknown: retained in regular history. Review every movement before marking recovery only; keep mixed workouts in training."}
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  s.recoveryOnly
                    ? "Return this original workout to regular training totals?"
                    : "Confirm this entire session was recovery-only, with no regular training? It will be excluded from regular totals; its results stay intact.",
                )
              )
                void onClassify(s.id, !s.recoveryOnly);
            }}
          >
            {s.recoveryOnly ? "Include in regular training" : "Mark recovery only"}
          </Button>
        </div>
      ))}
    </div>
  );
}
const RECOVERY_SHORTCUT_KEY = "tt:show-recovery-shortcut";
function TodayShortcutPreference() {
  const [enabled, setEnabled] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(RECOVERY_SHORTCUT_KEY) !== "hidden",
  );
  return (
    <label className="flex items-center gap-2 border-t pt-3 text-sm text-muted-foreground">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => {
          setEnabled(e.target.checked);
          localStorage.setItem(RECOVERY_SHORTCUT_KEY, e.target.checked ? "shown" : "hidden");
        }}
      />
      Show a small due-work shortcut on Today (this browser)
    </label>
  );
}
