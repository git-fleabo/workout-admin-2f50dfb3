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

function firstPositiveNumber(value: string, fallback: number) {
  const number = Number(value.match(/\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function isSupportedSkillGoal(goal: GoalRow, exercise?: SkillGoalExercise) {
  if (!exercise || goal.status !== "active" || goal.exerciseId !== exercise.id) return false;
  if (exercise.workoutType.trim().toLowerCase() !== "skills/calisthenics") return false;
  const trackingMode = (goal.trackingMode ||
    getTrackingModeValue({
      workoutType: exercise.workoutType,
      movement: exercise.name,
      defaultMetric: exercise.metric,
    })) as TrackingMode;
  return ["reps_only", "hold", "grip_hold"].includes(trackingMode);
}

export function defaultSkillGoalLocation(exercise: SkillGoalExercise): PlannerLocation {
  return exercise.availableLocationKinds.includes("home") ? "home" : "gym";
}

export function buildSkillGoalDraft({
  goal,
  exercise,
  locationKind,
}: {
  goal: GoalRow;
  exercise: SkillGoalExercise;
  locationKind: PlannerLocation;
}): WorkoutPlanDraft {
  if (!isSupportedSkillGoal(goal, exercise)) {
    throw new Error("Choose an active calisthenics goal linked to an enabled Library movement.");
  }
  if (!exercise.availableLocationKinds.includes(locationKind)) {
    throw new Error(`${exercise.name} is not available at ${locationKind}.`);
  }
  const trackingMode = (goal.trackingMode ||
    getTrackingModeValue({
      workoutType: exercise.workoutType,
      movement: exercise.name,
      defaultMetric: exercise.metric,
    })) as TrackingMode;
  const sets = Math.min(6, Math.max(1, Math.round(firstPositiveNumber(exercise.suggestedSets, 3))));
  const dose = firstPositiveNumber(exercise.suggestedReps, trackingMode === "reps_only" ? 5 : 10);
  const hold = trackingMode === "hold" || trackingMode === "grip_hold";
  return {
    version: 1,
    title: `${goal.goal} practice`,
    locationKind,
    basis: `Supporting practice for ${goal.goal}. The starting dose comes from the enabled Library movement and remains editable before training.`,
    movements: [
      {
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
          reps: hold ? "" : String(dose),
          weight: "",
          durationSeconds: hold ? String(dose) : "",
          rpe: "",
          completed: true,
        })),
      },
    ],
  };
}
