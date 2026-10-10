import { completedItemCoveredBySavedPlans } from "./completed-coach-work.ts";
import type { CoachingPreferences } from "./coaching-preferences.ts";
import type { SavedWorkoutPlan } from "./supabase-plans.browser.ts";
import type { ProgrammeScheduleSession } from "./supabase-programmes.browser.ts";
import type { WorkoutPlanDraft, WorkoutPlanKind } from "./workout-plan.ts";
import type { WeeklyPlan, WeeklyPlanItemKind } from "./weekly-plan.ts";

export type WeeklyCoachCapacityKind =
  | "strength"
  | "climbing"
  | "conditioning"
  | "yoga"
  | "mobility"
  | "skill"
  | "other";

export type WeeklyCoachCapacitySession = {
  id: string;
  date: string;
  title: string;
  kind: WeeklyCoachCapacityKind;
  minutes: number;
  demanding: boolean;
  source: "programme" | "saved" | "completed" | "proposed";
};

export type WeeklyCoachCapacity = {
  status: "balanced" | "near_limit" | "over_limit";
  headline: string;
  weeklyMinutes: number;
  plannedMinutes: number;
  remainingMinutes: number;
  weeklyTrainingDays: number;
  plannedDays: number;
  remainingDays: number;
  maxDemandingDays: number;
  demandingDays: number;
  remainingDemandingDays: number;
  sessions: WeeklyCoachCapacitySession[];
  byKind: Array<{ kind: WeeklyCoachCapacityKind; sessions: number; minutes: number }>;
};

export type WeeklyCoachCapacityAddition = {
  id: string;
  date: string;
  title: string;
  planKind: WorkoutPlanKind;
  draft: WorkoutPlanDraft;
  estimatedMinutes?: number;
};

const DEMANDING = new Set<WeeklyCoachCapacityKind>(["strength", "climbing", "conditioning"]);

function positiveNumber(value: string | undefined) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function capacityKind(planKind: WorkoutPlanKind): WeeklyCoachCapacityKind {
  return planKind === "strength" ||
    planKind === "climbing" ||
    planKind === "conditioning" ||
    planKind === "yoga" ||
    planKind === "mobility" ||
    planKind === "skill"
    ? planKind
    : "other";
}

function completedKind(kind: WeeklyPlanItemKind): WeeklyCoachCapacityKind {
  if (kind === "home" || kind === "gym") return "strength";
  if (kind === "climb") return "climbing";
  if (kind === "recovery") return "mobility";
  return "conditioning";
}

function defaultMinutes(kind: WeeklyCoachCapacityKind) {
  if (kind === "strength") return 45;
  if (kind === "climbing") return 45;
  if (kind === "conditioning") return 30;
  if (kind === "yoga") return 30;
  if (kind === "mobility") return 15;
  if (kind === "skill") return 15;
  return 30;
}

export function estimateWorkoutDraftMinutes(draft: WorkoutPlanDraft, planKind: WorkoutPlanKind) {
  const kind = capacityKind(planKind);
  const movementMinutes = draft.movements.reduce(
    (total, movement) => total + positiveNumber(movement.targets.durationMinutes),
    0,
  );
  const blockMinutes = (draft.methodBlocks ?? []).reduce(
    (total, block) => total + positiveNumber(block.blockDurationMinutes),
    0,
  );
  const explicitMinutes = Math.max(movementMinutes, blockMinutes);
  if (explicitMinutes > 0) return Math.max(5, Math.round(explicitMinutes));

  const sets = draft.movements.reduce((total, movement) => total + movement.setRows.length, 0);
  if (kind === "strength") return Math.min(90, Math.max(30, 10 + sets * 3));
  if (kind === "skill") return Math.min(30, Math.max(10, 5 + sets * 2));
  if (kind === "mobility") return Math.min(30, Math.max(10, 5 + sets * 2));
  return defaultMinutes(kind);
}

function programmeMinutes(session: ProgrammeScheduleSession) {
  if (session.movements.length) {
    return estimateWorkoutDraftMinutes(
      {
        version: 1,
        title: session.workoutName,
        locationKind: "gym",
        basis: "Programme session",
        movements: session.movements,
      },
      "strength",
    );
  }
  return Math.min(90, Math.max(30, session.movementNames.length * 10));
}

function summarizeCapacity(
  sessions: WeeklyCoachCapacitySession[],
  preferences: CoachingPreferences,
): WeeklyCoachCapacity {
  const plannedMinutes = sessions.reduce((total, session) => total + session.minutes, 0);
  const plannedDays = new Set(sessions.map((session) => session.date)).size;
  const demandingDays = new Set(
    sessions.filter((session) => session.demanding).map((session) => session.date),
  ).size;
  const over =
    plannedMinutes > preferences.weeklyMinutes ||
    plannedDays > preferences.weeklyTrainingDays ||
    demandingDays > preferences.maxDemandingDays;
  const near =
    !over &&
    (plannedMinutes >= preferences.weeklyMinutes * 0.85 ||
      plannedDays >= preferences.weeklyTrainingDays ||
      demandingDays >= preferences.maxDemandingDays);
  const status = over ? "over_limit" : near ? "near_limit" : "balanced";
  const headline = over
    ? "The planned week exceeds at least one saved limit."
    : near
      ? "The planned week is close to its saved capacity."
      : "The planned week fits inside your saved capacity.";
  const byKindMap = new Map<
    WeeklyCoachCapacityKind,
    { kind: WeeklyCoachCapacityKind; sessions: number; minutes: number }
  >();
  for (const session of sessions) {
    const summary = byKindMap.get(session.kind) ?? {
      kind: session.kind,
      sessions: 0,
      minutes: 0,
    };
    summary.sessions += 1;
    summary.minutes += session.minutes;
    byKindMap.set(session.kind, summary);
  }
  return {
    status,
    headline,
    weeklyMinutes: preferences.weeklyMinutes,
    plannedMinutes,
    remainingMinutes: Math.max(0, preferences.weeklyMinutes - plannedMinutes),
    weeklyTrainingDays: preferences.weeklyTrainingDays,
    plannedDays,
    remainingDays: Math.max(0, preferences.weeklyTrainingDays - plannedDays),
    maxDemandingDays: preferences.maxDemandingDays,
    demandingDays,
    remainingDemandingDays: Math.max(0, preferences.maxDemandingDays - demandingDays),
    sessions: [...sessions].sort(
      (left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
    ),
    byKind: Array.from(byKindMap.values()).sort((left, right) =>
      left.kind.localeCompare(right.kind),
    ),
  };
}

export function buildWeeklyCoachCapacity({
  plan,
  programmeSessions,
  scheduledPlans,
  preferences,
  additions = [],
}: {
  plan: WeeklyPlan;
  programmeSessions: ProgrammeScheduleSession[];
  scheduledPlans: SavedWorkoutPlan[];
  preferences: CoachingPreferences;
  additions?: WeeklyCoachCapacityAddition[];
}) {
  const sessions: WeeklyCoachCapacitySession[] = programmeSessions
    .filter((session) => session.date >= plan.startDate && session.date <= plan.endDate)
    .map((session) => ({
      id: `programme:${session.assignmentId}:${session.programWorkoutId}`,
      date: session.date,
      title: `${session.programmeName} · ${session.workoutName}`,
      kind: "strength" as const,
      minutes: programmeMinutes(session),
      demanding: true,
      source: "programme" as const,
    }));

  for (const saved of scheduledPlans) {
    if (
      !saved.suggestedFor ||
      saved.suggestedFor < plan.startDate ||
      saved.suggestedFor > plan.endDate ||
      saved.programWorkoutId
    ) {
      continue;
    }
    const kind = capacityKind(saved.planKind);
    sessions.push({
      id: `saved:${saved.suggestedWorkoutId}`,
      date: saved.suggestedFor,
      title: saved.title,
      kind,
      minutes:
        saved.status === "completed" && saved.completedMinutes && saved.completedMinutes > 0
          ? saved.completedMinutes
          : estimateWorkoutDraftMinutes(saved, saved.planKind),
      demanding: DEMANDING.has(kind),
      source: "saved",
    });
  }

  for (const day of plan.days) {
    for (const item of day.completedItems) {
      if (completedItemCoveredBySavedPlans(day, item, scheduledPlans)) continue;
      const kind = completedKind(item);
      if (sessions.some((session) => session.date === day.date && session.kind === kind)) continue;
      sessions.push({
        id: `completed:${day.date}:${item}`,
        date: day.date,
        title: `Completed ${kind}`,
        kind,
        minutes: defaultMinutes(kind),
        demanding: DEMANDING.has(kind),
        source: "completed",
      });
    }
  }

  for (const addition of additions) {
    const kind = capacityKind(addition.planKind);
    sessions.push({
      id: `proposed:${addition.id}`,
      date: addition.date,
      title: addition.draft.title || addition.title,
      kind,
      minutes:
        addition.estimatedMinutes ?? estimateWorkoutDraftMinutes(addition.draft, addition.planKind),
      demanding: DEMANDING.has(kind),
      source: "proposed",
    });
  }

  return summarizeCapacity(sessions, preferences);
}

export function projectWeeklyCoachCapacity(
  current: WeeklyCoachCapacity,
  preferences: CoachingPreferences,
  additions: WeeklyCoachCapacityAddition[],
) {
  const existing = current.sessions.filter((session) => session.source !== "proposed");
  const proposed = additions.map((addition): WeeklyCoachCapacitySession => {
    const kind = capacityKind(addition.planKind);
    return {
      id: `proposed:${addition.id}`,
      date: addition.date,
      title: addition.draft.title || addition.title,
      kind,
      minutes:
        addition.estimatedMinutes ?? estimateWorkoutDraftMinutes(addition.draft, addition.planKind),
      demanding: DEMANDING.has(kind),
      source: "proposed",
    };
  });
  return summarizeCapacity([...existing, ...proposed], preferences);
}
