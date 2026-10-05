import { getTrackingModeValue, type TrackingMode } from "./movement-metrics.ts";
import type { GoalRow } from "./training-types.ts";
import type { PlannerLocation, WorkoutPlanDraft } from "./workout-plan.ts";

export type ProgrammeSupportKind = "goal" | "mobility";
export type ProgrammeSupportPlacement = "with_strength" | "separate" | "either";

export type ProgrammeSupportTrack = {
  id: string;
  kind: ProgrammeSupportKind;
  title: string;
  sessionsPerWeek: number;
  placement: ProgrammeSupportPlacement;
  locationKind: PlannerLocation;
};

export type ProgrammeSupportOccurrence = {
  trackId: string;
  kind: ProgrammeSupportKind;
  title: string;
  date: string;
  placement: ProgrammeSupportPlacement;
  locationKind: PlannerLocation;
  pairedWithStrength: boolean;
};

export type SkillGoalExercise = {
  id: string;
  name: string;
  workoutType: string;
  metric: string;
  suggestedSets: string;
  suggestedReps: string;
  availableLocationKinds: Array<"home" | "gym" | "other">;
};

export type SkillPracticeHistoryEntry = {
  date: string;
  plannedSets: number;
  plannedDose: number;
  successful: boolean;
};

export type SkillPracticeDoseRecommendation = {
  sets: number;
  value: number;
  unit: "reps" | "seconds";
  decision: "start" | "repeat" | "progress" | "goal_reached";
  completedWeeks: number;
  successfulWeeks: number;
  explanation: string;
};

export type ProgrammeSupportPlanHistoryEntry = {
  date: string;
  status: string;
  goalId: string | null;
  mobilityRunId: string | null;
  locationKind: PlannerLocation;
  plannedSets?: number;
  plannedDose?: number;
  doseUnit?: "reps" | "seconds";
};

export type ProgrammeSupportReviewTrack = {
  id: string;
  kind: ProgrammeSupportKind;
  sourceId: string;
  sessionsPerWeek: number;
  placement: ProgrammeSupportPlacement;
  locationKind: PlannerLocation;
};

export type ProgrammeSupportBlockReview = {
  startDate: string;
  endDate: string;
  plannedSessions: number;
  completedSessions: number;
  tracks: ProgrammeSupportReviewTrack[];
};

export type ProgrammeSupportProgressTrack = {
  id: string;
  kind: ProgrammeSupportKind;
  sourceId: string;
  plannedSessions: number;
  completedSessions: number;
  plannedSets: number | null;
  plannedDose: number | null;
  doseUnit: "reps" | "seconds" | null;
};

export type ProgrammeSupportBlockProgress = {
  startDate: string;
  endDate: string;
  started: boolean;
  currentWeek: number;
  totalWeeks: number;
  plannedSessions: number;
  completedSessions: number;
  currentWeekPlannedSessions: number;
  currentWeekCompletedSessions: number;
  nextSessionDate: string | null;
  tracks: ProgrammeSupportProgressTrack[];
};

const DAY_MS = 86_400_000;

function parseISO(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = parseISO(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return toISO(date);
}

function dayDistance(left: string, right: string) {
  const a = parseISO(left)?.getTime();
  const b = parseISO(right)?.getTime();
  if (a == null || b == null) return 0;
  return Math.abs(a - b) / DAY_MS;
}

function mondayOf(value: string) {
  const date = parseISO(value);
  if (!date) return value;
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return toISO(date);
}

function datesBetween(startDate: string, endDate: string) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (!start || !end || start > end) return [];
  const dates: string[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(toISO(cursor));
  }
  return dates;
}

export function programmeSupportHorizon(startDate: string, programmeEndDate: string) {
  const fourWeeks = addDays(startDate, 27);
  return programmeEndDate && programmeEndDate < fourWeeks ? programmeEndDate : fourWeeks;
}

export function buildProgrammeSupportSchedule({
  startDate,
  endDate,
  programmeDates,
  tracks,
}: {
  startDate: string;
  endDate: string;
  programmeDates: string[];
  tracks: ProgrammeSupportTrack[];
}): ProgrammeSupportOccurrence[] {
  const strengthDates = new Set(
    programmeDates.filter((date) => date >= startDate && date <= endDate),
  );
  const weeks = new Map<string, string[]>();
  for (const date of datesBetween(startDate, endDate)) {
    const week = mondayOf(date);
    weeks.set(week, [...(weeks.get(week) ?? []), date]);
  }

  const occurrences: ProgrammeSupportOccurrence[] = [];
  const loadByDate = new Map<string, number>();
  for (const track of tracks.slice(0, 2)) {
    for (const weekDates of weeks.values()) {
      const target = Math.min(4, Math.max(1, Math.round(track.sessionsPerWeek)));
      const chosen: string[] = [];
      while (chosen.length < Math.min(target, weekDates.length)) {
        const candidates = weekDates.filter((date) => !chosen.includes(date));
        const best = candidates
          .map((date) => {
            const paired = strengthDates.has(date);
            const placementScore =
              track.placement === "with_strength"
                ? paired
                  ? 80
                  : 0
                : track.placement === "separate"
                  ? paired
                    ? 0
                    : 80
                  : 40;
            const spacing = chosen.length
              ? Math.min(...chosen.map((other) => dayDistance(date, other))) * 8
              : 24;
            const dateLoad = (loadByDate.get(date) ?? 0) * -25;
            return { date, score: placementScore + spacing + dateLoad };
          })
          .sort(
            (left, right) => right.score - left.score || left.date.localeCompare(right.date),
          )[0];
        if (!best) break;
        chosen.push(best.date);
        loadByDate.set(best.date, (loadByDate.get(best.date) ?? 0) + 1);
      }
      occurrences.push(
        ...chosen.map((date) => ({
          trackId: track.id,
          kind: track.kind,
          title: track.title,
          date,
          placement: track.placement,
          locationKind: track.locationKind,
          pairedWithStrength: strengthDates.has(date),
        })),
      );
    }
  }
  return occurrences.sort(
    (left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title),
  );
}

export function buildProgrammeSupportBlockReview({
  plans,
  today,
  programmeDates,
}: {
  plans: ProgrammeSupportPlanHistoryEntry[];
  today: string;
  programmeDates: string[];
}): ProgrammeSupportBlockReview | null {
  const dated = plans
    .filter((plan) => parseISO(plan.date))
    .sort((left, right) => left.date.localeCompare(right.date));
  const endDate = dated.at(-1)?.date;
  if (!endDate || endDate >= today) return null;

  const startDate = addDays(endDate, -27);
  const block = dated.filter((plan) => plan.date >= startDate && plan.date <= endDate);
  const strengthDates = new Set(programmeDates);
  const byTrack = new Map<string, ProgrammeSupportPlanHistoryEntry[]>();
  for (const plan of block) {
    const id = plan.goalId
      ? `goal:${plan.goalId}`
      : plan.mobilityRunId
        ? `mobility:${plan.mobilityRunId}`
        : null;
    if (!id) continue;
    byTrack.set(id, [...(byTrack.get(id) ?? []), plan]);
  }

  const tracks = Array.from(byTrack.entries()).map(([id, entries]) => {
    const weeks = new Map<string, number>();
    const locations = new Map<PlannerLocation, number>();
    let pairedSessions = 0;
    for (const entry of entries) {
      const week = mondayOf(entry.date);
      weeks.set(week, (weeks.get(week) ?? 0) + 1);
      locations.set(entry.locationKind, (locations.get(entry.locationKind) ?? 0) + 1);
      if (strengthDates.has(entry.date)) pairedSessions += 1;
    }
    const sessionsPerWeek = Math.min(3, Math.max(1, ...weeks.values()));
    const locationKind =
      [...locations.entries()].sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )[0]?.[0] ?? "gym";
    return {
      id,
      kind: id.startsWith("goal:") ? ("goal" as const) : ("mobility" as const),
      sourceId: id.slice(id.indexOf(":") + 1),
      sessionsPerWeek,
      placement:
        pairedSessions === entries.length
          ? ("with_strength" as const)
          : pairedSessions === 0
            ? ("separate" as const)
            : ("either" as const),
      locationKind,
    };
  });

  return {
    startDate,
    endDate,
    plannedSessions: block.length,
    completedSessions: block.filter((plan) => plan.status === "completed").length,
    tracks,
  };
}

export function buildProgrammeSupportBlockProgress({
  plans,
  today,
}: {
  plans: ProgrammeSupportPlanHistoryEntry[];
  today: string;
}): ProgrammeSupportBlockProgress | null {
  const dated = plans
    .filter((plan) => parseISO(plan.date))
    .sort((left, right) => left.date.localeCompare(right.date));
  const endDate = dated.at(-1)?.date;
  if (!endDate || endDate < today) return null;

  const windowStart = addDays(endDate, -27);
  const block = dated.filter((plan) => plan.date >= windowStart && plan.date <= endDate);
  const startDate = block[0]?.date;
  if (!startDate) return null;
  const started = startDate <= today;
  const totalWeeks = Math.min(4, Math.max(1, Math.ceil((dayDistance(startDate, endDate) + 1) / 7)));
  const currentWeek = started
    ? Math.min(totalWeeks, Math.floor(dayDistance(startDate, today) / 7) + 1)
    : 1;
  const currentWeekStart = addDays(startDate, (currentWeek - 1) * 7);
  const currentWeekEnd = addDays(currentWeekStart, 6);
  const currentWeekPlans = block.filter(
    (plan) => plan.date >= currentWeekStart && plan.date <= currentWeekEnd,
  );
  const byTrack = new Map<string, ProgrammeSupportPlanHistoryEntry[]>();
  for (const plan of block) {
    const id = plan.goalId
      ? `goal:${plan.goalId}`
      : plan.mobilityRunId
        ? `mobility:${plan.mobilityRunId}`
        : null;
    if (!id) continue;
    byTrack.set(id, [...(byTrack.get(id) ?? []), plan]);
  }
  const tracks = Array.from(byTrack.entries()).map(([id, entries]) => {
    const dose = [...entries]
      .reverse()
      .find((entry) => entry.plannedSets && entry.plannedDose && entry.doseUnit);
    return {
      id,
      kind: id.startsWith("goal:") ? ("goal" as const) : ("mobility" as const),
      sourceId: id.slice(id.indexOf(":") + 1),
      plannedSessions: entries.length,
      completedSessions: entries.filter((entry) => entry.status === "completed").length,
      plannedSets: dose?.plannedSets ?? null,
      plannedDose: dose?.plannedDose ?? null,
      doseUnit: dose?.doseUnit ?? null,
    };
  });
  const nextSession = block.find(
    (plan) => plan.date >= today && plan.status !== "completed" && plan.status !== "skipped",
  );

  return {
    startDate,
    endDate,
    started,
    currentWeek,
    totalWeeks,
    plannedSessions: block.length,
    completedSessions: block.filter((plan) => plan.status === "completed").length,
    currentWeekPlannedSessions: currentWeekPlans.length,
    currentWeekCompletedSessions: currentWeekPlans.filter((plan) => plan.status === "completed")
      .length,
    nextSessionDate: nextSession?.date ?? null,
    tracks,
  };
}

function firstPositiveNumber(value: string, fallback: number) {
  const number = Number(value.match(/\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function skillTrackingMode(goal: GoalRow, exercise: SkillGoalExercise) {
  return (goal.trackingMode ||
    getTrackingModeValue({
      workoutType: exercise.workoutType,
      movement: exercise.name,
      defaultMetric: exercise.metric,
    })) as TrackingMode;
}

export function isSupportedSkillGoal(goal: GoalRow, exercise?: SkillGoalExercise) {
  if (!exercise || goal.status !== "active" || goal.exerciseId !== exercise.id) return false;
  if (exercise.workoutType.trim().toLowerCase() !== "skills/calisthenics") return false;
  const trackingMode = skillTrackingMode(goal, exercise);
  return ["reps_only", "hold", "grip_hold"].includes(trackingMode);
}

export function defaultSkillGoalLocation(exercise: SkillGoalExercise): PlannerLocation {
  return exercise.availableLocationKinds.includes("home") ? "home" : "gym";
}

export function recommendSkillPracticeDose({
  goal,
  exercise,
  history = [],
}: {
  goal: GoalRow;
  exercise: SkillGoalExercise;
  history?: SkillPracticeHistoryEntry[];
}): SkillPracticeDoseRecommendation {
  const trackingMode = skillTrackingMode(goal, exercise);
  const hold = trackingMode === "hold" || trackingMode === "grip_hold";
  const unit = hold ? "seconds" : "reps";
  const startingSets = Math.min(
    6,
    Math.max(1, Math.round(firstPositiveNumber(exercise.suggestedSets, 3))),
  );
  const startingValue = Math.round(
    firstPositiveNumber(exercise.suggestedReps, trackingMode === "reps_only" ? 5 : 10),
  );
  const latest = [...history].sort((left, right) => left.date.localeCompare(right.date)).at(-1);
  if (!latest) {
    return {
      sets: startingSets,
      value: startingValue,
      unit,
      decision: "start",
      completedWeeks: 0,
      successfulWeeks: 0,
      explanation: `Start with the enabled Library dose: ${startingSets} × ${startingValue} ${unit}.`,
    };
  }

  const sameDose = history.filter(
    (entry) => entry.plannedSets === latest.plannedSets && entry.plannedDose === latest.plannedDose,
  );
  const entriesByWeek = new Map<string, SkillPracticeHistoryEntry[]>();
  for (const entry of sameDose) {
    const week = mondayOf(entry.date);
    entriesByWeek.set(week, [...(entriesByWeek.get(week) ?? []), entry]);
  }
  const completedWeeks = entriesByWeek.size;
  const successfulWeeks = Array.from(entriesByWeek.values()).filter((entries) =>
    entries.every((entry) => entry.successful),
  ).length;
  const base = {
    sets: latest.plannedSets,
    value: latest.plannedDose,
    unit,
    completedWeeks,
    successfulWeeks,
  };

  if (successfulWeeks < 4) {
    const remaining = 4 - successfulWeeks;
    return {
      ...base,
      decision: "repeat",
      explanation:
        completedWeeks >= 4
          ? `Repeat ${latest.plannedSets} × ${latest.plannedDose} ${unit}; fewer than four weeks were completed at the planned dose.`
          : `Repeat ${latest.plannedSets} × ${latest.plannedDose} ${unit} until it has been completed in ${remaining} more ${remaining === 1 ? "week" : "weeks"}.`,
    };
  }

  const target = goal.targetValue && goal.targetValue > 0 ? goal.targetValue : null;
  if (target != null && latest.plannedDose >= target) {
    return {
      ...base,
      decision: "goal_reached",
      explanation: `The practice dose has reached the ${target} ${unit} goal. Keep it here while you confirm the result in training.`,
    };
  }

  const increment = hold ? 2 : 1;
  const nextValue =
    target == null
      ? latest.plannedDose + increment
      : Math.min(target, latest.plannedDose + increment);
  return {
    ...base,
    value: nextValue,
    decision: "progress",
    explanation: `Four successful weeks support a small increase from ${latest.plannedDose} to ${nextValue} ${unit} per set.`,
  };
}

export function buildSkillGoalDraft({
  goal,
  exercise,
  locationKind,
  dose,
}: {
  goal: GoalRow;
  exercise: SkillGoalExercise;
  locationKind: PlannerLocation;
  dose?: Pick<SkillPracticeDoseRecommendation, "sets" | "value" | "explanation">;
}): WorkoutPlanDraft {
  if (!isSupportedSkillGoal(goal, exercise)) {
    throw new Error("Choose an active calisthenics goal linked to an enabled Library movement.");
  }
  if (!exercise.availableLocationKinds.includes(locationKind)) {
    throw new Error(`${exercise.name} is not available at ${locationKind}.`);
  }
  const trackingMode = skillTrackingMode(goal, exercise);
  const recommended = recommendSkillPracticeDose({ goal, exercise });
  const sets = Math.min(6, Math.max(1, Math.round(dose?.sets ?? recommended.sets)));
  const doseValue = Math.max(1, Math.round(dose?.value ?? recommended.value));
  const hold = trackingMode === "hold" || trackingMode === "grip_hold";
  return {
    version: 1,
    title: `${goal.goal} practice`,
    locationKind,
    basis: `Supporting practice for ${goal.goal}. ${dose?.explanation ?? recommended.explanation} The dose remains editable before training.`,
    movements: [
      {
        exerciseId: exercise.id,
        exercise: exercise.name,
        workoutType: exercise.workoutType,
        trackingMode,
        targets: {
          durationMinutes: "",
          distance: "",
          distanceUnit: "",
          rounds: "",
          height: "",
          detail: goal.targetValue
            ? `Goal: ${goal.targetValue} ${goal.targetUnit || goal.goalMetric}`
            : goal.goal,
        },
        sourceDate: "",
        reason: "Short skill practice placed around the primary strength programme.",
        restTime: "As needed for high-quality attempts",
        setRows: Array.from({ length: sets }, () => ({
          reps: hold ? "" : String(doseValue),
          weight: "",
          durationSeconds: hold ? String(doseValue) : "",
          rpe: "",
          completed: true,
        })),
      },
    ],
  };
}
