import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getLibraryClient } from "@/lib/supabase-log.browser";
import { getTrackingModeValue } from "@/lib/movement-metrics";
import { formatUKDate } from "@/lib/date";
import { FIXED_PROGRESSION, progressionSummary } from "@/lib/programme-progression";
import {
  personalPlanSchema,
  propagateProgrammeChanges,
  type PersonalProgrammeMovement,
  type PersonalProgrammeSession,
} from "@/lib/personal-programme";
import { savePersonalProgrammeSessionsClient } from "@/lib/supabase-personal-programmes.browser";
import type { ProgrammeAssignment, ProgrammeTemplate } from "@/lib/supabase-programmes.browser";

type Exercise = Awaited<ReturnType<typeof getLibraryClient>>["exercises"][number];
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const blankSet = () => ({ reps: "", weight: "", durationSeconds: "", rpe: "", completed: true });

export function ProgrammeSessionEditor({
  session,
  laterSessions,
  exercises,
  saving,
  onSave,
  onClose,
}: {
  session: PersonalProgrammeSession;
  laterSessions: PersonalProgrammeSession[];
  exercises: Exercise[];
  saving: boolean;
  onSave: (sessions: PersonalProgrammeSession[]) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PersonalProgrammeSession>(() => structuredClone(session));
  const [applyLater, setApplyLater] = useState(false);
  const [search, setSearch] = useState("");
  const [addId, setAddId] = useState("");
  const [error, setError] = useState("");
  const candidates = exercises.filter((exercise) => {
    const mode = getTrackingModeValue({
      workoutType: exercise.workoutType,
      movement: exercise.name,
      defaultMetric: exercise.metric,
    });
    return (
      exercise.workoutType.toLowerCase() === "strength" &&
      ["weight_reps", "reps_only", "hold", "grip_hold"].includes(mode)
    );
  });
  const patchMovement = (index: number, patch: Partial<PersonalProgrammeMovement>) =>
    setDraft((current) => ({
      ...current,
      plan: {
        ...current.plan,
        movements: current.plan.movements.map((movement, i) =>
          i === index ? { ...movement, ...patch } : movement,
        ),
      },
    }));
  const replaceExercise = (index: number, id: string) => {
    const exercise = candidates.find((item) => item.id === id);
    if (!exercise) return;
    const trackingMode = getTrackingModeValue({
      workoutType: exercise.workoutType,
      movement: exercise.name,
      defaultMetric: exercise.metric,
    });
    patchMovement(index, {
      exerciseId: exercise.id,
      exercise: exercise.name,
      workoutType: exercise.workoutType,
      trackingMode,
      reason: "",
      progression: { ...FIXED_PROGRESSION },
    });
  };
  const addExercise = () => {
    const exercise = candidates.find((item) => item.id === addId);
    if (!exercise) return;
    const movement: PersonalProgrammeMovement = {
      exerciseId: exercise.id,
      exercise: exercise.name,
      programmeKey: crypto.randomUUID(),
      workoutType: exercise.workoutType,
      trackingMode: getTrackingModeValue({
        workoutType: exercise.workoutType,
        movement: exercise.name,
        defaultMetric: exercise.metric,
      }),
      targets: {
        durationMinutes: "",
        distance: "",
        distanceUnit: "",
        rounds: "",
        height: "",
        detail: "",
      },
      sourceDate: "",
      reason: "",
      restTime: "",
      progression: { ...FIXED_PROGRESSION },
      setRows: [blankSet()],
    };
    setDraft((current) => ({
      ...current,
      plan: { ...current.plan, movements: [...current.plan.movements, movement] },
    }));
    setAddId("");
  };
  const moveMovement = (index: number, direction: number) =>
    setDraft((current) => {
      const movements = [...current.plan.movements];
      [movements[index], movements[index + direction]] = [
        movements[index + direction],
        movements[index],
      ];
      return { ...current, plan: { ...current.plan, movements } };
    });
  let propagated: PersonalProgrammeSession[] = [];
  let propagationError = "";
  if (applyLater) {
    try {
      propagated = propagateProgrammeChanges(session, draft, laterSessions);
    } catch (failure) {
      propagationError = (failure as Error).message;
    }
  }
  const save = async () => {
    setError("");
    if (!draft.name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(draft.scheduledDate)) {
      setError("Choose a session name and date.");
      return;
    }
    const parsed = personalPlanSchema.safeParse(draft.plan);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the exercise targets.");
      return;
    }
    if (propagationError) {
      setError(propagationError);
      return;
    }
    try {
      await onSave([{ ...draft, name: draft.name.trim(), plan: parsed.data }, ...propagated]);
    } catch (failure) {
      setError((failure as Error).message);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit {session.name}</DialogTitle>
          <DialogDescription>
            Set your workout up in advance. These are planned targets; record the work you actually
            do when you train.
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={saving} className="contents">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              Session name
              <Input
                aria-label="Session name"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              Planned date
              <Input
                aria-label="Planned date"
                type="date"
                value={draft.scheduledDate}
                onChange={(event) => setDraft({ ...draft, scheduledDate: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              Training place
              <select
                className={selectClass}
                aria-label="Training place"
                value={draft.plan.locationKind}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    plan: { ...draft.plan, locationKind: event.target.value as "home" | "gym" },
                  })
                }
              >
                <option value="gym">Gym</option>
                <option value="home">Home</option>
              </select>
            </label>
          </div>
          <div className="space-y-4">
            {draft.plan.movements.map((movement, index) => (
              <section
                key={movement.programmeKey}
                className="space-y-3 rounded-xl border border-border p-3 sm:p-4"
                aria-label={`${movement.exercise} targets`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">
                    {index + 1}. {movement.exercise}
                  </h3>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${movement.exercise} up`}
                      disabled={index === 0 || saving}
                      onClick={() => moveMovement(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${movement.exercise} down`}
                      disabled={index === draft.plan.movements.length - 1 || saving}
                      onClick={() => moveMovement(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${movement.exercise}`}
                      disabled={draft.plan.movements.length === 1 || saving}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          plan: {
                            ...draft.plan,
                            movements: draft.plan.movements.filter((_, i) => i !== index),
                          },
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <label className="block space-y-1 text-sm">
                  Exercise
                  <select
                    className={selectClass}
                    aria-label={`Exercise ${index + 1}`}
                    value={movement.exerciseId}
                    onChange={(event) => replaceExercise(index, event.target.value)}
                  >
                    {!candidates.some((exercise) => exercise.id === movement.exerciseId) && (
                      <option value={movement.exerciseId}>{movement.exercise}</option>
                    )}
                    {candidates.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="space-y-2">
                  {movement.setRows.map((set, setIndex) => (
                    <div key={setIndex} className="flex items-end gap-2">
                      <span className="w-7 shrink-0 pb-2 text-xs text-muted-foreground">
                        {setIndex + 1}
                      </span>
                      {["weight_reps", "grip_hold"].includes(movement.trackingMode) && (
                        <label className="min-w-0 flex-1 text-xs">
                          Load (kg)
                          <Input
                            aria-label={`${movement.exercise} set ${setIndex + 1} load`}
                            inputMode="decimal"
                            value={set.weight}
                            onChange={(event) =>
                              patchMovement(index, {
                                setRows: movement.setRows.map((row, i) =>
                                  i === setIndex ? { ...row, weight: event.target.value } : row,
                                ),
                              })
                            }
                          />
                        </label>
                      )}
                      <label className="min-w-0 flex-1 text-xs">
                        {["hold", "grip_hold"].includes(movement.trackingMode)
                          ? "Hold (seconds)"
                          : "Reps"}
                        <Input
                          aria-label={`${movement.exercise} set ${setIndex + 1} ${["hold", "grip_hold"].includes(movement.trackingMode) ? "hold" : "reps"}`}
                          inputMode="numeric"
                          value={
                            ["hold", "grip_hold"].includes(movement.trackingMode)
                              ? set.durationSeconds
                              : set.reps
                          }
                          onChange={(event) =>
                            patchMovement(index, {
                              setRows: movement.setRows.map((row, i) =>
                                i === setIndex
                                  ? {
                                      ...row,
                                      [["hold", "grip_hold"].includes(movement.trackingMode)
                                        ? "durationSeconds"
                                        : "reps"]: event.target.value,
                                    }
                                  : row,
                              ),
                            })
                          }
                        />
                      </label>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${movement.exercise} set ${setIndex + 1}`}
                        disabled={movement.setRows.length === 1 || saving}
                        onClick={() =>
                          patchMovement(index, {
                            setRows: movement.setRows.filter((_, i) => i !== setIndex),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={movement.setRows.length >= 20 || saving}
                  onClick={() =>
                    patchMovement(index, {
                      setRows: [...movement.setRows, { ...movement.setRows.at(-1)! }],
                    })
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Add set
                </Button>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    Rest between sets
                    <Input
                      aria-label={`${movement.exercise} rest`}
                      placeholder="e.g. 2–3 min"
                      value={movement.restTime ?? ""}
                      onChange={(event) => patchMovement(index, { restTime: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    Progression
                    <select
                      className={selectClass}
                      aria-label={`${movement.exercise} progression`}
                      value={movement.progression.type}
                      onChange={(event) =>
                        patchMovement(index, {
                          progression: {
                            ...movement.progression,
                            type: event.target.value as "fixed" | "double" | "source",
                          },
                        })
                      }
                    >
                      <option value="fixed">Follow saved session targets</option>
                      {movement.trackingMode === "weight_reps" && (
                        <option value="double">Build reps, then increase load</option>
                      )}
                      <option value="source">Follow source programme rules</option>
                    </select>
                  </label>
                </div>
                {movement.progression.type === "double" && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        ["minReps", "Starting reps"],
                        ["maxReps", "Upper reps"],
                        ["incrementKg", "Load increase (kg)"],
                        ["maxRpe", "Effort limit (RPE)"],
                      ] as const
                    ).map(([field, label]) => (
                      <label key={field} className="text-xs">
                        {label}
                        <Input
                          aria-label={`${movement.exercise} ${label}`}
                          type="number"
                          step={field === "incrementKg" ? "0.25" : "1"}
                          value={movement.progression[field]}
                          onChange={(event) =>
                            patchMovement(index, {
                              progression: {
                                ...movement.progression,
                                [field]: Number(event.target.value),
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {progressionSummary(movement.progression)}
                </p>
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Exercise guidance
                  </summary>
                  <Textarea
                    aria-label={`${movement.exercise} guidance`}
                    className="mt-2"
                    value={movement.reason}
                    onChange={(event) => patchMovement(index, { reason: event.target.value })}
                  />
                </details>
              </section>
            ))}
          </div>
          <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
            <Label htmlFor="programme-exercise-search">Add an exercise</Label>
            <Input
              id="programme-exercise-search"
              placeholder="Find an exercise…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="flex gap-2">
              <select
                className={selectClass}
                aria-label="New programme exercise"
                value={addId}
                onChange={(event) => setAddId(event.target.value)}
              >
                <option value="">Choose from your Library</option>
                {candidates
                  .filter((exercise) => exercise.name.toLowerCase().includes(search.toLowerCase()))
                  .map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
              </select>
              <Button
                variant="outline"
                disabled={!addId || saving || draft.plan.movements.length >= 30}
                onClick={addExercise}
              >
                Add
              </Button>
            </div>
          </div>
          {laterSessions.length > 0 && (
            <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={applyLater}
                onChange={(event) => setApplyLater(event.target.checked)}
              />
              <span>
                Use these exercise changes in later sessions
                <span className="mt-1 block text-xs text-muted-foreground">
                  Replacements, removals, targets, rest and progression are copied to matching
                  original exercise slots. New exercises, order and dates apply only to this
                  session.
                </span>
              </span>
            </label>
          )}
          {applyLater && (
            <p className="text-sm">
              {propagationError ||
                `${propagated.length} later sessions will change: ${propagated.map((item) => item.name).join(" · ") || "none"}. These exact targets replace their existing targets.`}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </fieldset>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || Boolean(propagationError)} onClick={() => void save()}>
            {saving ? "Saving…" : "Save future session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PersonalProgrammeEditor({
  assignment,
  template,
  lockedWorkoutIds,
}: {
  assignment: ProgrammeAssignment;
  template: ProgrammeTemplate;
  lockedWorkoutIds: string[];
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const library = useQuery({
    queryKey: ["library"],
    queryFn: getLibraryClient,
    staleTime: 300_000,
  });
  const personal = assignment.personalProgramme!;
  const sessions = template.workouts.flatMap((workout) => {
    const session = personal.sessions.find((item) => item.workoutId === workout.id);
    return session
      ? [{ ...session, sequenceIndex: workout.sequenceIndex, week: workout.weekNumber }]
      : [];
  });
  const editable = sessions.filter(
    (session) =>
      session.sequenceIndex >= assignment.currentWorkoutIndex &&
      !lockedWorkoutIds.includes(session.workoutId),
  );
  const selectedSession = editable.find((session) => session.workoutId === selected);
  const save = useMutation({
    mutationFn: (updates: PersonalProgrammeSession[]) =>
      savePersonalProgrammeSessionsClient(assignment.id, updates),
    onSuccess: async () => {
      await Promise.all(
        [
          "my-programme-overview",
          "programme-assignments",
          "programme-schedule",
          "programme-workout-offers",
          "programme-exercise-rule",
          "weekly-review",
        ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
      setSelected(null);
      toast.success("Future programme sessions updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const moveSession = (index: number, direction: number) => {
    const first = editable[index];
    const second = editable[index + direction];
    save.mutate([
      { ...first, name: second.name, plan: second.plan },
      { ...second, name: first.name, plan: first.plan },
    ]);
  };
  return (
    <section
      id="programme-editor"
      className="space-y-3 scroll-mt-24"
      aria-labelledby="programme-editor-heading"
    >
      <div>
        <h3 id="programme-editor-heading" className="font-semibold">
          {assignment.status === "paused"
            ? "Review and edit before you start"
            : "Your programme, session by session"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Open Saved targets for the exact prescription. Edit future workouts or move them within
          the sequence. Started and completed sessions stay fixed; dates are reminders, so train
          when ready.
        </p>
      </div>
      {library.error && (
        <p role="alert" className="text-sm text-destructive">
          Your exercise Library could not be loaded. Refresh before editing.
        </p>
      )}
      <div className="max-h-[32rem] space-y-2 overflow-y-auto rounded-lg border border-border p-2">
        {sessions.map((session) => {
          const index = editable.findIndex((item) => item.workoutId === session.workoutId);
          const canEdit = index >= 0;
          const state =
            session.sequenceIndex < assignment.currentWorkoutIndex
              ? "Past session"
              : lockedWorkoutIds.includes(session.workoutId)
                ? "Started or skipped"
                : session.sequenceIndex === assignment.currentWorkoutIndex
                  ? "Next"
                  : "Upcoming";
          return (
            <div key={session.workoutId} className="rounded-lg bg-muted/25 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {session.sequenceIndex + 1}. {session.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {state} · {formatUKDate(session.scheduledDate)} ·{" "}
                    {session.plan.locationKind === "home" ? "Home" : "Gym"}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move session ${session.sequenceIndex + 1} up`}
                      disabled={index === 0 || save.isPending}
                      onClick={() => moveSession(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Move session ${session.sequenceIndex + 1} down`}
                      disabled={index === editable.length - 1 || save.isPending}
                      onClick={() => moveSession(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!library.data || save.isPending}
                      onClick={() => setSelected(session.workoutId)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {session.plan.movements
                  .map((movement) => `${movement.exercise} (${movement.setRows.length} sets)`)
                  .join(" · ")}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium">Saved targets</summary>
                {session.plan.movements.map((movement) => (
                  <p key={movement.programmeKey} className="mt-1 text-xs">
                    {movement.exercise}:{" "}
                    {movement.setRows
                      .map((set) =>
                        [
                          set.weight ? `${set.weight} kg` : "",
                          set.reps ? `${set.reps} reps` : "",
                          set.durationSeconds ? `${set.durationSeconds}s` : "",
                        ]
                          .filter(Boolean)
                          .join(" × "),
                      )
                      .join(" / ")}{" "}
                    · Rest {movement.restTime || "as needed"}
                  </p>
                ))}
              </details>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        The starting template stays protected. Your completed work is available in{" "}
        <Link to="/history" className="underline">
          History
        </Link>
        .
      </p>
      {selectedSession && library.data && (
        <ProgrammeSessionEditor
          key={`${selectedSession.workoutId}:${selectedSession.revision}`}
          session={selectedSession}
          laterSessions={editable.filter(
            (session) => session.sequenceIndex > selectedSession.sequenceIndex,
          )}
          exercises={library.data.exercises}
          saving={save.isPending}
          onSave={async (updates) => {
            await save.mutateAsync(updates);
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
