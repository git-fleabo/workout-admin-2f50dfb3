import { personalStrengthReviewIsStale } from "@/lib/personal-strength-review";
import { CalendarDays, RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUKDate } from "@/lib/date";
import {
  buildStrengthProgrammeFollowUpProposal,
  buildStrengthProgrammeReview,
  type ProgrammeStrengthWeekReview,
  type StrengthProgrammeReview,
} from "@/lib/strength-programme-review";
import type { ProgrammeAssignment, ProgrammeTemplate } from "@/lib/supabase-programmes.browser";
import type { WeeklyRecoveryRecommendation } from "@/lib/weekly-recovery";
import type { WorkoutPlanMovement } from "@/lib/workout-plan";

const ADJUSTMENT_OPTIONS = [
  { value: -5, label: "Much lighter", detail: "5 percentage points lower" },
  { value: -2.5, label: "A little lighter", detail: "2.5 percentage points lower" },
  { value: 0, label: "Use automatic plan", detail: "No manual override" },
  { value: 2.5, label: "A little heavier", detail: "2.5 percentage points higher" },
  { value: 5, label: "Much heavier", detail: "5 percentage points higher" },
] as const;

const PERSONAL_ADJUSTMENT_OPTIONS = [
  { value: -5, label: "5% lighter", detail: "than my saved loads" },
  { value: -2.5, label: "2.5% lighter", detail: "than my saved loads" },
  { value: 0, label: "Use my saved targets", detail: "No reduction" },
] as const;

const SET_ADJUSTMENT_OPTIONS = [
  { value: 0, label: "Keep programmed sets" },
  { value: -1, label: "One fewer working set where possible" },
] as const;

function points(value: number, personal = false) {
  if (value === 0) return "No change";
  return `${value > 0 ? "+" : ""}${value}${personal ? "%" : " pts"}`;
}

function prescriptionSummary(movement: WorkoutPlanMovement) {
  const sets = movement.setRows;
  const first = sets[0];
  const allMatch = sets.every(
    (set) =>
      set.reps === first?.reps &&
      set.weight === first?.weight &&
      set.durationSeconds === first?.durationSeconds,
  );
  if (allMatch && first) {
    const reps = first.durationSeconds
      ? `${first.durationSeconds} sec`
      : first.reps
        ? `${first.reps} reps`
        : "prescribed reps";
    const load = first.weight ? ` @ ${first.weight} kg` : "";
    return `${sets.length} × ${reps}${load}`;
  }
  return sets
    .map((set, index) => {
      const reps = set.durationSeconds
        ? `${set.durationSeconds} sec`
        : set.reps
          ? `${set.reps} reps`
          : "prescribed reps";
      const load = set.weight ? ` @ ${set.weight} kg` : "";
      return `Set ${index + 1}: ${reps}${load}`;
    })
    .join(" · ");
}

export function ProgrammeRefreshCard({
  assignment,
  template,
  recovery,
  appliedReview,
  saving,
  onSave,
  onApplyReview,
}: {
  assignment: ProgrammeAssignment;
  template: ProgrammeTemplate;
  recovery: WeeklyRecoveryRecommendation;
  appliedReview: ProgrammeStrengthWeekReview | null;
  saving: boolean;
  onSave: (
    updates: Array<{
      exerciseId: string;
      trainingMax: number;
      manualAdjustmentPercent: number;
    }>,
  ) => Promise<void>;
  onApplyReview: (review: StrengthProgrammeReview) => Promise<void>;
}) {
  const personal = Boolean(assignment.personalProgramme);
  const exercises = useMemo(
    () =>
      assignment.exercises.filter((exercise) => exercise.enabled && exercise.trainingMax != null),
    [assignment.exercises],
  );
  const [mode, setMode] = useState<"coach" | "manual" | null>(null);
  const [draftAdjustments, setDraftAdjustments] = useState<Record<string, number>>({});
  const [draftSetAdjustments, setDraftSetAdjustments] = useState<Record<string, number>>({});
  const [draftTrainingMaxes, setDraftTrainingMaxes] = useState<Record<string, string>>({});
  const awaitingAppliedWeek =
    appliedReview != null &&
    assignment.currentWorkoutIndex <= appliedReview.endWorkoutIndex &&
    (!personal || !personalStrengthReviewIsStale(assignment, appliedReview));
  const followUpProposal = useMemo(
    () =>
      appliedReview
        ? buildStrengthProgrammeFollowUpProposal({ assignment, template, recovery, appliedReview })
        : null,
    [appliedReview, assignment, template, recovery],
  );
  const defaultCoachReview = useMemo(() => {
    if (awaitingAppliedWeek) return null;
    return buildStrengthProgrammeReview({
      assignment,
      template,
      recovery,
      proposal: followUpProposal,
    });
  }, [assignment, awaitingAppliedWeek, followUpProposal, recovery, template]);
  const coachReview = useMemo(
    () =>
      buildStrengthProgrammeReview({
        assignment,
        template,
        recovery,
        manualAdjustments: mode === "coach" ? draftAdjustments : undefined,
        setAdjustments: mode === "coach" ? draftSetAdjustments : undefined,
        proposal: followUpProposal,
      }),
    [assignment, draftAdjustments, draftSetAdjustments, followUpProposal, mode, recovery, template],
  );
  const activeOverrides = (personal ? (appliedReview?.exercises ?? []) : exercises).filter(
    (exercise) => exercise.manualAdjustmentPercent !== 0,
  );
  const changed = exercises.flatMap((exercise) => {
    const nextAdjustment = draftAdjustments[exercise.id] ?? exercise.manualAdjustmentPercent;
    const nextTrainingMax = Number(draftTrainingMaxes[exercise.id] ?? exercise.trainingMax);
    return nextAdjustment === exercise.manualAdjustmentPercent &&
      nextTrainingMax === exercise.trainingMax
      ? []
      : [
          {
            exerciseId: exercise.id,
            trainingMax: nextTrainingMax,
            manualAdjustmentPercent: nextAdjustment,
          },
        ];
  });
  const hasInvalidTrainingMax = exercises.some((exercise) => {
    const value = Number(draftTrainingMaxes[exercise.id] ?? exercise.trainingMax);
    return !Number.isFinite(value) || value < 0.5 || value > 1000;
  });

  const resetDrafts = (
    adjustments: Record<string, number>,
    setAdjustments: Record<string, number> = {},
  ) => {
    setDraftAdjustments(adjustments);
    setDraftSetAdjustments(setAdjustments);
    setDraftTrainingMaxes(
      Object.fromEntries(exercises.map((exercise) => [exercise.id, String(exercise.trainingMax)])),
    );
  };

  const openCoachReview = () => {
    if (!defaultCoachReview) return;
    resetDrafts(
      Object.fromEntries(
        defaultCoachReview.exercises.map((exercise) => [
          exercise.assignmentExerciseId,
          exercise.proposedManualAdjustmentPercent,
        ]),
      ),
      Object.fromEntries(
        defaultCoachReview.exercises.map((exercise) => [
          exercise.assignmentExerciseId,
          exercise.proposedSetAdjustment,
        ]),
      ),
    );
    setMode("coach");
  };

  const openManualReview = () => {
    resetDrafts(
      Object.fromEntries(
        exercises.map((exercise) => [exercise.id, exercise.manualAdjustmentPercent]),
      ),
    );
    setMode("manual");
  };

  const save = async () => {
    try {
      if (mode === "coach" && coachReview) await onApplyReview(coachReview);
      else await onSave(changed);
      setMode(null);
    } catch {
      // The parent mutation owns the user-facing error toast; keep the dialog open for correction.
    }
  };

  return (
    <>
      <Card className="border-cyan-400/20 bg-cyan-400/[0.04]">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">
                  {awaitingAppliedWeek
                    ? "Strength review applied"
                    : (defaultCoachReview?.title ??
                      (personal
                        ? "No unstarted strength sessions to review"
                        : "Refresh upcoming sessions"))}
                </p>
                {awaitingAppliedWeek ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Awaiting results
                  </Badge>
                ) : defaultCoachReview?.programmeWeek ? (
                  <Badge variant="outline" className="text-[10px]">
                    Programme week {defaultCoachReview.programmeWeek}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    {assignment.currentWorkoutIndex} completed
                  </Badge>
                )}
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                {awaitingAppliedWeek
                  ? personal
                    ? "Complete this reviewed week and log the actual sets and effort. Later sessions use your original targets unless you approve another change."
                    : `Complete programme week ${appliedReview?.programmeWeek ?? "review"}. The coach will compare the recorded lift outcomes before drafting the following week.`
                  : (defaultCoachReview?.detail ??
                    (personal
                      ? "Resume or finish your current session from Today. Your original personal targets remain saved."
                      : "Amend a training max or review a lift after a week that felt too hard or too easy. Every unstarted programme session is recalculated from the saved values."))}
              </p>
              {activeOverrides.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeOverrides.map((exercise) => (
                    <Badge
                      key={"id" in exercise ? exercise.id : exercise.assignmentExerciseId}
                      variant="secondary"
                      className="text-[10px]"
                    >
                      {exercise.exerciseName} {points(exercise.manualAdjustmentPercent, personal)}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {defaultCoachReview ? (
              <Button onClick={openCoachReview} disabled={!defaultCoachReview.exercises.length}>
                <Sparkles className="mr-2 h-4 w-4" /> Review exact week
              </Button>
            ) : null}
            {!personal ? (
              <Button variant="outline" onClick={openManualReview} disabled={!exercises.length}>
                <SlidersHorizontal className="mr-2 h-4 w-4" /> Adjust manually
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog open={mode != null} onOpenChange={(open) => !saving && !open && setMode(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === "coach"
                ? (coachReview?.title ?? "Review next strength week")
                : "Update programme"}
            </DialogTitle>
            <DialogDescription>
              {mode === "coach"
                ? "This is a draft. Check the precise sessions and load choice for each lift; nothing changes until you apply it."
                : "Amend training maxes and load adjustments independently. Upcoming, unstarted prescriptions refresh immediately; completed workouts, started drafts, and scheduled dates do not change."}
            </DialogDescription>
          </DialogHeader>

          {mode === "coach" && coachReview ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] p-3">
                <p className="text-xs font-medium">Why this draft</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {coachReview.detail}
                </p>
                <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  {coachReview.evidence.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                {coachReview.exercises.map((exercise) => (
                  <div
                    key={exercise.assignmentExerciseId}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{exercise.exerciseName}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {personal ? (
                            "Your original loads, rep/hold targets, rest and progression rules are retained."
                          ) : (
                            <>
                              {exercise.trainingMax} kg training max · automatic{" "}
                              {points(exercise.automaticAdjustmentPercent)}
                            </>
                          )}
                        </p>
                      </div>
                      <Badge
                        variant={
                          exercise.proposedCombinedAdjustmentPercent < 0 ? "secondary" : "outline"
                        }
                      >
                        Proposed {points(exercise.proposedCombinedAdjustmentPercent, personal)}
                        {exercise.proposedSetAdjustment < 0 ? " · one fewer set" : ""}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {exercise.reason}
                    </p>
                    <p className="mt-3 text-xs font-medium">Weekly load choice</p>
                    <Select
                      disabled={personal && exercise.hasLoadTargets === false}
                      value={String(exercise.proposedManualAdjustmentPercent)}
                      onValueChange={(value) =>
                        setDraftAdjustments((current) => ({
                          ...current,
                          [exercise.assignmentExerciseId]: Number(value),
                        }))
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(personal ? PERSONAL_ADJUSTMENT_OPTIONS : ADJUSTMENT_OPTIONS).map(
                          (option) => (
                            <SelectItem key={option.value} value={String(option.value)}>
                              {option.label} · {option.detail}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <p className="mt-3 text-xs font-medium">Weekly set choice</p>
                    <Select
                      disabled={personal && exercise.hasReducibleSets === false}
                      value={String(exercise.proposedSetAdjustment)}
                      onValueChange={(value) =>
                        setDraftSetAdjustments((current) => ({
                          ...current,
                          [exercise.assignmentExerciseId]: Number(value),
                        }))
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SET_ADJUSTMENT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={String(option.value)}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-sm font-semibold">Exact upcoming prescriptions</p>
                <div className="mt-2 space-y-3">
                  {coachReview.sessions.map((session) => (
                    <div key={session.workoutId} className="rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{session.workoutName}</p>
                        {session.scheduledDate ? (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <CalendarDays className="h-3 w-3" />
                            {formatUKDate(session.scheduledDate)}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 space-y-2">
                        {session.movements.map(
                          (
                            { exerciseId, exerciseName, movement, originalMovement },
                            movementIndex,
                          ) => (
                            <div
                              key={`${session.workoutId}-${exerciseId}-${movementIndex}`}
                              className="text-xs"
                            >
                              <p className="font-medium">{exerciseName}</p>
                              {originalMovement ? (
                                <p className="mt-0.5 text-muted-foreground">
                                  Saved: {prescriptionSummary(originalMovement)}
                                </p>
                              ) : null}
                              <p className="mt-0.5 text-muted-foreground">
                                {originalMovement ? "Reviewed: " : ""}
                                {prescriptionSummary(movement)}
                                {movement.restTime ? ` · Rest ${movement.restTime}` : ""}
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-3 text-xs leading-relaxed text-muted-foreground">
                Applying this review changes the temporary load override and set count used to
                calculate this reviewed week. Completed workouts, started drafts, dates, training
                maxes and the programme template stay as they are.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {exercises.map((exercise) => {
                const automatic = exercise.loadAdjustmentPercent;
                const manual = draftAdjustments[exercise.id] ?? exercise.manualAdjustmentPercent;
                const combined = automatic + manual;
                return (
                  <div
                    key={exercise.id}
                    data-testid={`programme-adjustment-${exercise.slotKey}`}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{exercise.exerciseName}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {exercise.trainingMax} kg training max · automatic {points(automatic)}
                          {exercise.lastDecision ? ` (${exercise.lastDecision})` : ""}
                        </p>
                      </div>
                      <Badge variant={combined < 0 ? "secondary" : "outline"}>
                        Combined {points(combined)}
                      </Badge>
                    </div>
                    <label
                      className="mt-3 block text-xs font-medium"
                      htmlFor={`training-max-${exercise.id}`}
                    >
                      Training max (kg)
                    </label>
                    <Input
                      id={`training-max-${exercise.id}`}
                      data-testid={`programme-training-max-${exercise.slotKey}`}
                      className="mt-1"
                      type="number"
                      min="0.5"
                      max="1000"
                      step="0.5"
                      inputMode="decimal"
                      value={draftTrainingMaxes[exercise.id] ?? String(exercise.trainingMax)}
                      onChange={(event) =>
                        setDraftTrainingMaxes((current) => ({
                          ...current,
                          [exercise.id]: event.target.value,
                        }))
                      }
                    />
                    <p className="mt-3 text-xs font-medium">Upcoming load adjustment</p>
                    <Select
                      value={String(manual)}
                      onValueChange={(value) =>
                        setDraftAdjustments((current) => ({
                          ...current,
                          [exercise.id]: Number(value),
                        }))
                      }
                    >
                      <SelectTrigger className="mt-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ADJUSTMENT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={String(option.value)}>
                            {option.label} · {option.detail}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] p-3 text-xs leading-relaxed text-muted-foreground">
                A training-max change is the new basis for every later percentage calculation in
                this programme. Manual load changes stay active until reset. Use the lighter options
                if pain or technique deteriorated; do not use either control to train through pain.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setMode(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={
                saving ||
                hasInvalidTrainingMax ||
                (mode === "manual" && !changed.length) ||
                (mode === "coach" && !coachReview)
              }
            >
              {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === "coach" ? "Apply reviewed week" : "Refresh upcoming sessions"}
            </Button>
          </DialogFooter>
          {mode === "coach" && coachReview?.changedExerciseCount === 0 ? (
            <p className="text-center text-[11px] text-muted-foreground">
              No load or set change is needed. Applying saves this reviewed week for the follow-up
              check.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
