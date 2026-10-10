import { decideAdaptiveProgression } from "./adaptive-strength.ts";
import {
  personalPlanSchema,
  type PersonalProgrammePlan,
  type PersonalProgrammeSession,
} from "./personal-programme.ts";
import type { ProgrammeAssignment, ProgrammeTemplate } from "./supabase-programmes.browser.ts";
import type {
  ProgrammeStrengthWeekReview,
  ProgrammeStrengthWeekOutcome,
  StrengthProgrammeReview,
  StrengthProgrammeReviewProposal,
} from "./strength-programme-review.ts";
import type { WeeklyRecoveryRecommendation } from "./weekly-recovery.ts";

export type PersonalStrengthReviewSnapshot = {
  workoutId: string;
  revision: number;
  name: string;
  scheduledDate: string;
  basePlan: PersonalProgrammePlan;
  plan: PersonalProgrammePlan;
};
export const personalStrengthKey = (programmeKey: string, exerciseId: string) =>
  `${programmeKey}:${exerciseId.toLowerCase()}`;

// Match Postgres numeric round(..., 2), including decimal half-cent boundaries.
export function reviewedPersonalLoad(value: string, percent: number) {
  if (!value || percent === 0 || Number(value) <= 0) return value;
  const [whole, fraction = ""] = value.split(".");
  const factor = BigInt(1000 + percent * 10);
  const numerator = BigInt(whole + fraction) * factor * 100n;
  const denominator = 10n ** BigInt(fraction.length) * 1000n;
  const cents = (numerator + denominator / 2n) / denominator;
  if (cents === 0n) return value;
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`.replace(/\.?0+$/, "");
}

export function personalStrengthReviewPlan(
  plan: PersonalProgrammePlan,
  adjustments: Array<{
    personalKey?: string;
    assignmentExerciseId: string;
    manualAdjustmentPercent: number;
    setAdjustment: number;
  }>,
) {
  return {
    ...plan,
    movements: plan.movements.map((movement) => {
      const adjustment = adjustments.find(
        (item) =>
          (item.personalKey ?? item.assignmentExerciseId) ===
          personalStrengthKey(movement.programmeKey, movement.exerciseId),
      );
      if (!adjustment) return movement;
      const rows =
        adjustment.setAdjustment === -1 && movement.setRows.length > 1
          ? movement.setRows.slice(0, -1)
          : movement.setRows;
      return {
        ...movement,
        setRows: rows.map((row) => ({
          ...row,
          weight: ["weight_reps", "grip_hold"].includes(movement.trackingMode)
            ? reviewedPersonalLoad(row.weight, adjustment.manualAdjustmentPercent)
            : row.weight,
        })),
      };
    }),
  };
}

export function readPersonalStrengthReviewSnapshots(
  value: unknown,
): PersonalStrengthReviewSnapshot[] {
  if (!Array.isArray(value)) return [];
  const metadata = value.find(
    (item) => item && typeof item === "object" && Array.isArray(item.personal_sessions),
  );
  return (metadata?.personal_sessions ?? []).flatMap((row: Record<string, unknown>) => {
    if (!row || typeof row !== "object") return [];
    const base = personalPlanSchema.safeParse(row.base_plan),
      plan = personalPlanSchema.safeParse(row.plan);
    if (
      !base.success ||
      !plan.success ||
      typeof row.workout_id !== "string" ||
      typeof row.revision !== "number" ||
      typeof row.name !== "string" ||
      typeof row.scheduled_date !== "string"
    )
      return [];
    return [
      {
        workoutId: row.workout_id,
        revision: row.revision,
        name: row.name,
        scheduledDate: row.scheduled_date,
        basePlan: base.data,
        plan: plan.data,
      },
    ];
  });
}
export function personalStrengthSnapshotMatches(
  session: PersonalProgrammeSession,
  snapshot: PersonalStrengthReviewSnapshot,
) {
  return (
    session.revision === snapshot.revision &&
    session.name === snapshot.name &&
    session.scheduledDate === snapshot.scheduledDate &&
    JSON.stringify(session.plan) === JSON.stringify(snapshot.basePlan)
  );
}
export function personalStrengthReviewIsStale(
  assignment: ProgrammeAssignment,
  review: ProgrammeStrengthWeekReview,
) {
  return (review.personalSessions ?? []).some((snapshot) => {
    const session = assignment.personalProgramme?.sessions.find(
      (item) => item.workoutId === snapshot.workoutId,
    );
    return !session || !personalStrengthSnapshotMatches(session, snapshot);
  });
}
function nextPersonalWorkouts(assignment: ProgrammeAssignment, template: ProgrammeTemplate) {
  const remaining = template.workouts.filter(
    (workout) =>
      workout.sequenceIndex >= assignment.currentWorkoutIndex &&
      !assignment.reviewLockedWorkoutIds?.includes(workout.id),
  );
  const first = remaining[0];
  if (!first) return [];
  return first.weekNumber != null
    ? remaining.filter((workout) => workout.weekNumber === first.weekNumber)
    : remaining.slice(0, Math.max(1, template.sessionsPerWeek ?? 1));
}
export function buildPersonalStrengthProgrammeReview({
  assignment,
  template,
  recovery,
  manualAdjustments,
  setAdjustments,
  proposal,
}: {
  assignment: ProgrammeAssignment;
  template: ProgrammeTemplate;
  recovery: WeeklyRecoveryRecommendation;
  manualAdjustments?: Record<string, number>;
  setAdjustments?: Record<string, number>;
  proposal?: StrengthProgrammeReviewProposal | null;
}): StrengthProgrammeReview | null {
  if (
    !assignment.personalProgramme ||
    assignment.personalProgramme.sessions.some((session) => session.plan.baseStrength) ||
    assignment.status !== "active" ||
    template.id !== assignment.programId
  )
    return null;
  const workouts = nextPersonalWorkouts(assignment, template);
  const sessions = workouts.map((workout) => ({
    workout,
    session: assignment.personalProgramme!.sessions.find(
      (session) => session.workoutId === workout.id,
    ),
  }));
  if (!sessions.length || sessions.some((item) => !item.session)) return null;
  const movements = new Map(
    sessions.flatMap(({ session }) =>
      session!.plan.movements.map(
        (movement) =>
          [personalStrengthKey(movement.programmeKey, movement.exerciseId), movement] as const,
      ),
    ),
  );
  const exercises = [...movements.entries()].map(([key, movement]) => {
    const loaded = sessions.some(({ session }) =>
      session!.plan.movements.some(
        (item) =>
          personalStrengthKey(item.programmeKey, item.exerciseId) === key &&
          ["weight_reps", "grip_hold"].includes(item.trackingMode) &&
          item.setRows.some((row) => Number(row.weight) > 0),
      ),
    );
    const reducible = sessions.some(({ session }) =>
      session!.plan.movements.some(
        (item) =>
          personalStrengthKey(item.programmeKey, item.exerciseId) === key &&
          item.setRows.length > 1,
      ),
    );
    const proposed =
      manualAdjustments?.[key] ??
      proposal?.manualAdjustments[key] ??
      (recovery.level === "deload" ? -5 : recovery.level === "lighter" ? -2.5 : 0);
    const percent = loaded ? ([-5, -2.5, 0].includes(proposed) ? proposed : 0) : 0;
    return {
      assignmentExerciseId: key,
      personalKey: key,
      programmeKey: movement.programmeKey,
      exerciseId: movement.exerciseId,
      exerciseName: movement.exercise,
      trainingMax: 0,
      hasLoadTargets: loaded,
      hasReducibleSets: reducible,
      automaticAdjustmentPercent: 0,
      currentManualAdjustmentPercent: 0,
      proposedManualAdjustmentPercent: percent,
      proposedCombinedAdjustmentPercent: percent,
      proposedSetAdjustment:
        reducible &&
        (setAdjustments?.[key] === -1 ||
          (setAdjustments?.[key] == null &&
            (proposal?.setAdjustments[key] ?? (recovery.level === "deload" ? -1 : 0)) === -1))
          ? -1
          : 0,
      reason:
        proposal?.exerciseReasons[key] ??
        "Use your saved prescription as the baseline; only this reviewed week receives the selected reduction.",
    };
  });
  const copy = proposal ?? {
    recommendationKind: recovery.level === "normal" ? ("keep" as const) : ("reduce" as const),
    previousReviewId: null,
    title:
      recovery.level === "normal"
        ? "Keep your next strength week on plan"
        : "Review a lighter personal strength week",
    detail:
      "Review changes relative to your saved loads and sets. Exercises, dates, rep/hold targets, rest and progression rules stay as saved; later weeks and restarts retain your original targets.",
    evidence: recovery.evidence,
  };
  return {
    isPersonal: true,
    expectedCurrentWorkoutIndex: assignment.currentWorkoutIndex,
    programmeWeek: workouts[0].weekNumber,
    startWorkoutIndex: workouts[0].sequenceIndex,
    endWorkoutIndex: workouts.at(-1)!.sequenceIndex,
    ...copy,
    exercises,
    sessions: sessions.map(({ workout, session }) => ({
      workoutId: workout.id,
      workoutName: session!.name,
      scheduledDate: session!.scheduledDate,
      sessionNumber: workout.sessionNumber,
      personalRevision: session!.revision,
      movements: personalStrengthReviewPlan(
        session!.plan,
        exercises.map((exercise) => ({
          ...exercise,
          manualAdjustmentPercent: exercise.proposedManualAdjustmentPercent,
          setAdjustment: exercise.proposedSetAdjustment,
        })),
      ).movements.map((movement) => ({
        exerciseId: movement.exerciseId,
        exerciseName: movement.exercise,
        originalMovement: session!.plan.movements.find(
          (original) => original.programmeKey === movement.programmeKey,
        ),
        movement,
      })),
    })),
    changedExerciseCount: exercises.filter(
      (exercise) =>
        exercise.proposedManualAdjustmentPercent !== 0 || exercise.proposedSetAdjustment !== 0,
    ).length,
  };
}

export function buildPersonalStrengthFollowUp({
  assignment,
  template,
  recovery,
  appliedReview,
}: {
  assignment: ProgrammeAssignment;
  template: ProgrammeTemplate;
  recovery: WeeklyRecoveryRecommendation;
  appliedReview: ProgrammeStrengthWeekReview;
}): StrengthProgrammeReviewProposal | null {
  const stale = personalStrengthReviewIsStale(assignment, appliedReview);
  if (!stale && assignment.currentWorkoutIndex <= appliedReview.endWorkoutIndex) return null;
  const upcoming = buildPersonalStrengthProgrammeReview({ assignment, template, recovery });
  if (!upcoming) return null;
  const manualAdjustments: Record<string, number> = {},
    setAdjustments: Record<string, number> = {},
    exerciseReasons: Record<string, string> = {};
  const evidence: string[] = [];
  const decisions: Array<"restore" | "hold" | "extend"> = [];
  if (!stale)
    for (const previous of appliedReview.exercises) {
      if (
        !previous.personalKey ||
        !upcoming.exercises.some((exercise) => exercise.personalKey === previous.personalKey)
      )
        continue;
      const exposures = (appliedReview.personalSessions ?? []).filter((session) =>
        session.plan.movements.some(
          (movement) =>
            personalStrengthKey(movement.programmeKey, movement.exerciseId) ===
            previous.personalKey,
        ),
      );
      const outcomes = appliedReview.outcomes.filter(
        (outcome) => outcome.assignmentExerciseId === previous.personalKey,
      );
      const regressed = outcomes.some(
        (outcome) =>
          outcome.decision === "regress" ||
          outcome.technique === "poor" ||
          (outcome.pain ?? 0) >= 4,
      );
      const complete =
        exposures.length > 0 &&
        exposures.every((session) =>
          outcomes.some(
            (outcome) => outcome.workoutId === session.workoutId && outcome.decision === "progress",
          ),
        );
      const decision = regressed
        ? "extend"
        : complete && recovery.level === "normal"
          ? "restore"
          : "hold";
      decisions.push(decision);
      manualAdjustments[previous.personalKey] =
        decision === "restore"
          ? 0
          : recovery.level === "deload" || regressed
            ? -5
            : Math.min(previous.manualAdjustmentPercent, recovery.level === "lighter" ? -2.5 : 0);
      setAdjustments[previous.personalKey] =
        decision === "restore"
          ? 0
          : regressed || recovery.level === "deload"
            ? -1
            : previous.setAdjustment;
      exerciseReasons[previous.personalKey] =
        decision === "restore"
          ? "Every reviewed exposure met its targets with complete, comfortable effort evidence. Return to this week's own saved targets."
          : decision === "extend"
            ? "Pain or poor technique supports another small reduction relative to this week's own saved targets."
            : "Missing, changed or incomplete exposures do not support removing the reduction yet.";
      evidence.push(
        `${previous.exerciseName}: ${outcomes.filter((outcome) => outcome.decision === "progress").length}/${exposures.length} reviewed exposures met targets with complete evidence`,
      );
    }
  const kind =
    stale || !decisions.length
      ? recovery.level === "normal"
        ? "keep"
        : "reduce"
      : decisions.includes("extend")
        ? "extend"
        : decisions.includes("hold")
          ? "hold"
          : "restore";
  return {
    recommendationKind: kind,
    previousReviewId: appliedReview.id,
    title: stale
      ? "Refresh the changed strength week"
      : kind === "restore"
        ? "Return to your saved strength targets"
        : kind === "extend"
          ? "Extend the lighter personal strength week"
          : kind === "hold"
            ? "Hold the personal strength reduction"
            : upcoming.title,
    detail: stale
      ? "A saved session changed after approval. Review the latest prescriptions before replacing the temporary week; started snapshots stay intact."
      : "The next week uses its own custom baseline. Only matching exercises carry a reviewed reduction; swaps and progression rules remain as saved.",
    evidence: [
      ...(stale ? ["The previous preview no longer matches every saved session."] : evidence),
      ...recovery.evidence,
    ],
    manualAdjustments,
    setAdjustments,
    exerciseReasons,
  };
}

export type PersonalStrengthCompletedEntry = {
  exercise_id: string | null;
  order_index: number;
  completed: boolean;
  entry_sets: Array<{
    set_number: number;
    reps: number | null;
    weight: number | null;
    duration_seconds: number | null;
    rpe: number | null;
    completed: boolean;
    entry_set_segments?: unknown[];
  }> | null;
  entry_metrics: Array<{
    metric_key: string;
    metric_value: number | null;
    metric_text: string | null;
  }> | null;
};
export function personalStrengthOutcomes(
  snapshot: PersonalStrengthReviewSnapshot,
  entries: PersonalStrengthCompletedEntry[],
): ProgrammeStrengthWeekOutcome[] {
  return snapshot.plan.movements.map((movement, index) => {
    const matches = entries.filter(
      (entry) =>
        entry.exercise_id?.toLowerCase() === movement.exerciseId.toLowerCase() &&
        entry.order_index === index,
    );
    const entry = matches.length === 1 ? matches[0] : null;
    const rows = [...(entry?.entry_sets ?? [])].sort((a, b) => a.set_number - b.set_number);
    const metrics = entry?.entry_metrics ?? [];
    const pain = metrics.find((metric) => metric.metric_key === "pain")?.metric_value ?? null;
    const techniqueText = metrics.find((metric) => metric.metric_key === "technique")?.metric_text;
    const technique =
      techniqueText === "good" || techniqueText === "acceptable" || techniqueText === "poor"
        ? techniqueText
        : null;
    const effort = rows.filter((row) => row.rpe != null).map((row) => row.rpe!);
    const allEffort =
      effort.length === movement.setRows.length && rows.length === movement.setRows.length;
    const explicitDose = movement.setRows.every(
      (row) =>
        (["hold", "grip_hold"].includes(movement.trackingMode)
          ? Number(row.durationSeconds) > 0
          : Number(row.reps) > 0) &&
        (!["weight_reps", "grip_hold"].includes(movement.trackingMode) || row.weight.trim() !== ""),
    );
    const targetsMet =
      explicitDose &&
      rows.length === movement.setRows.length &&
      rows.every(
        (row, i) =>
          row.completed &&
          row.set_number === i + 1 &&
          !row.entry_set_segments?.length &&
          (!movement.setRows[i].reps ||
            (row.reps != null && row.reps >= Number(movement.setRows[i].reps))) &&
          (!movement.setRows[i].weight || row.weight === Number(movement.setRows[i].weight)) &&
          (!movement.setRows[i].durationSeconds ||
            (row.duration_seconds != null &&
              row.duration_seconds >= Number(movement.setRows[i].durationSeconds))),
      );
    const rpe = allEffort ? Math.max(...effort) : null;
    const decision = entry
      ? decideAdaptiveProgression({
          completed: entry.completed,
          rpe: targetsMet ? rpe : null,
          rpeCap: movement.progression.maxRpe,
          technique,
          pain,
        })
      : "repeat";
    return {
      assignmentExerciseId: personalStrengthKey(movement.programmeKey, movement.exerciseId),
      workoutId: snapshot.workoutId,
      decision,
      rpe,
      technique,
      pain,
    };
  });
}
