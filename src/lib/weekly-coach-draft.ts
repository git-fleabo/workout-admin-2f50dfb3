import type { CoachingPreferences } from "./coaching-preferences.ts";
import type { ProgrammeScheduleSession } from "./supabase-programmes.browser.ts";
import type { SavedWorkoutPlan } from "./supabase-plans.browser.ts";
import type { WorkoutPlanDraft, WorkoutPlanKind } from "./workout-plan.ts";
import type { WeeklyPlan } from "./weekly-plan.ts";
import type { WeeklyCoachRollover } from "./weekly-coach-rollover.ts";
import type { CoachReadinessSnapshot } from "./coach-readiness.ts";
import type { WeeklyCoachDecisionHistory } from "./weekly-coach-recommendation.ts";
import {
  buildWeeklyCoachCapacity,
  projectWeeklyCoachCapacity,
  type WeeklyCoachCapacity,
} from "./weekly-coach-capacity.ts";
import {
  buildWeeklyCoachAdaptation,
  type WeeklyCoachAdaptation,
} from "./weekly-coach-adaptation.ts";

export type WeeklyCoachDraftPriority = "primary" | "supporting" | "maintenance";

export type WeeklyCoachDraftCandidate = {
  focusId: string;
  sourceId: string;
  kind: "skill" | "mobility";
  title: string;
  defaultPlacement: "with_strength" | "separate" | "either";
  draft: WorkoutPlanDraft;
  planKind: Extract<WorkoutPlanKind, "skill" | "mobility">;
  goalId: string | null;
  mobilityRunId: string | null;
  programAssignmentId: string | null;
  estimatedMinutes: number;
};

export type WeeklyCoachDraftAddition = WeeklyCoachDraftCandidate & {
  id: string;
  date: string;
  priority: WeeklyCoachDraftPriority;
  reason: string;
  pairedWithStrength: boolean;
};

export type WeeklyCoachDraft = {
  startDate: string;
  endDate: string;
  today: string;
  weeklyTrainingDays: number;
  existingDates: string[];
  weekDates: string[];
  availableDates: string[];
  additions: WeeklyCoachDraftAddition[];
  summary: string;
  rollover: WeeklyCoachRollover | null;
  preferences: CoachingPreferences;
  capacity: WeeklyCoachCapacity;
  adaptation: WeeklyCoachAdaptation;
  sourceFingerprint: string;
};

function dayDistance(left: string, right: string) {
  const leftTime = new Date(`${left}T00:00:00Z`).getTime();
  const rightTime = new Date(`${right}T00:00:00Z`).getTime();
  return Math.abs(leftTime - rightTime) / 86_400_000;
}

function focusIdForPlan(plan: SavedWorkoutPlan) {
  if (plan.goalId) return `goal:${plan.goalId}`;
  if (plan.mobilityRunId) return `mobility:${plan.mobilityRunId}`;
  return null;
}

function priorityOrder(preferences: CoachingPreferences) {
  return [
    { focusId: preferences.primaryFocusId, priority: "primary" as const },
    ...preferences.secondaryFocusIds.map((focusId) => ({
      focusId,
      priority: "supporting" as const,
    })),
    ...preferences.maintenanceFocusIds.map((focusId) => ({
      focusId,
      priority: "maintenance" as const,
    })),
  ].filter(
    (item, index, items) =>
      item.focusId !== "programme" &&
      items.findIndex((candidate) => candidate.focusId === item.focusId) === index,
  );
}

function sourceFingerprint({
  plan,
  programmeSessions,
  scheduledPlans,
  preferences,
  candidates,
  readiness,
  history,
  rollover,
  adaptation,
}: {
  plan: WeeklyPlan;
  programmeSessions: ProgrammeScheduleSession[];
  scheduledPlans: SavedWorkoutPlan[];
  preferences: CoachingPreferences;
  candidates: WeeklyCoachDraftCandidate[];
  readiness?: CoachReadinessSnapshot;
  history: WeeklyCoachDecisionHistory[];
  rollover: WeeklyCoachRollover | null;
  adaptation: WeeklyCoachAdaptation;
}) {
  return JSON.stringify({
    version: 1,
    week: [plan.startDate, plan.endDate],
    completed: plan.days.map((day) => [
      day.date,
      [...day.completedItems].sort(),
      [...(day.completedEvidence ?? [])].sort(
        (left, right) =>
          left.sessionId.localeCompare(right.sessionId) || left.item.localeCompare(right.item),
      ),
    ]),
    programme: programmeSessions
      .map((session) => [
        session.assignmentId,
        session.programWorkoutId,
        session.date,
        session.status,
      ])
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    scheduled: scheduledPlans
      .map((saved) => [
        saved.suggestedWorkoutId,
        saved.suggestedFor,
        saved.status,
        saved.planKind,
        saved.goalId,
        saved.mobilityRunId,
        saved.completedSessionId,
        saved.completedMinutes,
        saved.movements,
        saved.methodBlocks,
      ])
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    preferences,
    candidates: candidates
      .map((candidate) => [
        candidate.focusId,
        candidate.sourceId,
        candidate.planKind,
        candidate.programAssignmentId,
        candidate.estimatedMinutes,
        candidate.draft,
      ])
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    readiness: readiness
      ? [
          readiness.status,
          readiness.maxPain,
          readiness.hardDays,
          readiness.effortCoverage,
          readiness.supportAdherence,
          readiness.supportDue,
          readiness.recoveryLevel,
        ]
      : null,
    outcomes: history
      .filter((item) => item.weekStart < plan.startDate && item.outcomeRating)
      .map((item) => [
        item.weekStart,
        item.recommendationType,
        item.subjectFocusId,
        item.outcomeRating,
      ])
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
      .slice(-12),
    rollover: rollover
      ? [rollover.status, rollover.adherencePercent, rollover.additionLimit]
      : null,
    adaptation: [
      adaptation.mode,
      adaptation.additionLimit,
      adaptation.confidence,
      adaptation.hasMixedEvidence,
    ],
  });
}

function chooseDate({
  candidate,
  dates,
  strengthDates,
  occupiedDates,
  loadByDate,
  weeklyTrainingDays,
}: {
  candidate: WeeklyCoachDraftCandidate;
  dates: string[];
  strengthDates: Set<string>;
  occupiedDates: Set<string>;
  loadByDate: Map<string, number>;
  weeklyTrainingDays: number;
}) {
  const canOpenAnotherDay = occupiedDates.size < weeklyTrainingDays;
  const scored = dates.flatMap((date) => {
    const occupied = occupiedDates.has(date);
    if (!occupied && !canOpenAnotherDay) return [];
    const strength = strengthDates.has(date);
    const load = loadByDate.get(date) ?? 0;
    const spacing = occupiedDates.size
      ? Math.min(...Array.from(occupiedDates).map((other) => dayDistance(date, other)))
      : 3;
    const placement =
      candidate.defaultPlacement === "with_strength"
        ? strength
          ? 120
          : occupied
            ? 45
            : 20
        : candidate.defaultPlacement === "separate"
          ? !occupied
            ? 100
            : strength
              ? 10
              : 45
          : !occupied
            ? 70
            : 45;
    return [{ date, score: placement + spacing * 5 - load * 18 }];
  });
  return scored.sort(
    (left, right) => right.score - left.score || left.date.localeCompare(right.date),
  )[0]?.date;
}

export function buildWeeklyCoachDraft({
  plan,
  programmeSessions,
  scheduledPlans,
  preferences,
  candidates,
  today,
  rollover = null,
  readiness,
  history = [],
}: {
  plan: WeeklyPlan;
  programmeSessions: ProgrammeScheduleSession[];
  scheduledPlans: SavedWorkoutPlan[];
  preferences: CoachingPreferences;
  candidates: WeeklyCoachDraftCandidate[];
  today: string;
  rollover?: WeeklyCoachRollover | null;
  readiness?: CoachReadinessSnapshot;
  history?: WeeklyCoachDecisionHistory[];
}): WeeklyCoachDraft {
  const weekDates = plan.days
    .map((day) => day.date)
    .filter((date) => date >= plan.startDate && date <= plan.endDate);
  const availableDates = weekDates.filter(
    (date) => date >= today && date >= plan.startDate && date <= plan.endDate,
  );
  const programmeInWeek = programmeSessions.filter(
    (session) => session.date >= plan.startDate && session.date <= plan.endDate,
  );
  const scheduledInWeek = scheduledPlans.filter(
    (saved) =>
      saved.suggestedFor &&
      saved.suggestedFor >= plan.startDate &&
      saved.suggestedFor <= plan.endDate,
  );
  const represented = new Set<string>([
    ...(programmeInWeek.length ? ["programme"] : []),
    ...scheduledInWeek.flatMap((saved) => {
      const focusId = focusIdForPlan(saved);
      return focusId ? [focusId] : [];
    }),
  ]);
  const existingDates = Array.from(
    new Set([
      ...programmeInWeek.map((session) => session.date),
      ...scheduledInWeek.map((saved) => saved.suggestedFor as string),
      ...plan.days.filter((day) => day.completedItems.length).map((day) => day.date),
    ]),
  ).sort();
  const occupiedDates = new Set(existingDates);
  const strengthDates = new Set([
    ...programmeInWeek.map((session) => session.date),
    ...scheduledInWeek
      .filter((saved) => saved.planKind === "strength")
      .map((saved) => saved.suggestedFor as string),
    ...plan.days
      .filter((day) => day.completedItems.some((item) => item === "home" || item === "gym"))
      .map((day) => day.date),
  ]);
  const loadByDate = new Map<string, number>();
  for (const date of [
    ...programmeInWeek.map((session) => session.date),
    ...scheduledInWeek.map((saved) => saved.suggestedFor as string),
    ...plan.days.flatMap((day) => day.completedItems.map(() => day.date)),
  ]) {
    loadByDate.set(date, (loadByDate.get(date) ?? 0) + 1);
  }
  const existingCapacity = buildWeeklyCoachCapacity({
    plan,
    programmeSessions,
    scheduledPlans,
    preferences,
  });
  const adaptation = buildWeeklyCoachAdaptation({
    readiness,
    capacity: existingCapacity,
    history,
    currentWeek: plan.startDate,
    rollover,
  });
  let plannedMinutes = existingCapacity.plannedMinutes;

  const additions: WeeklyCoachDraftAddition[] = [];
  if (preferences.saved && existingCapacity.status !== "over_limit") {
    const candidateByFocus = new Map(candidates.map((candidate) => [candidate.focusId, candidate]));
    for (const item of priorityOrder(preferences)) {
      if (additions.length >= adaptation.additionLimit || represented.has(item.focusId)) {
        continue;
      }
      const candidate = candidateByFocus.get(item.focusId);
      if (!candidate) continue;
      if (plannedMinutes + candidate.estimatedMinutes > preferences.weeklyMinutes) continue;
      const date = chooseDate({
        candidate,
        dates: availableDates,
        strengthDates,
        occupiedDates,
        loadByDate,
        weeklyTrainingDays: preferences.weeklyTrainingDays,
      });
      if (!date) continue;
      const wasOccupied = occupiedDates.has(date);
      const pairedWithStrength = strengthDates.has(date);
      const reason = pairedWithStrength
        ? "Placed beside a saved strength session so it does not create another training day."
        : wasOccupied
          ? `Shares an existing training day to stay within your ${preferences.weeklyTrainingDays}-day week.`
          : `Uses an open day and stays within your ${preferences.weeklyTrainingDays}-day week.`;
      additions.push({
        ...candidate,
        id: `weekly-draft:${candidate.focusId}`,
        date,
        priority: item.priority,
        reason,
        pairedWithStrength,
      });
      represented.add(item.focusId);
      occupiedDates.add(date);
      loadByDate.set(date, (loadByDate.get(date) ?? 0) + 1);
      plannedMinutes += candidate.estimatedMinutes;
    }
  }

  const capacity = buildWeeklyCoachCapacity({
    plan,
    programmeSessions,
    scheduledPlans,
    preferences,
    additions,
  });
  const fingerprint = sourceFingerprint({
    plan,
    programmeSessions: programmeInWeek,
    scheduledPlans: scheduledInWeek,
    preferences,
    candidates,
    readiness,
    history,
    rollover,
    adaptation,
  });

  const summary = !preferences.saved
    ? "Save your coaching priorities before drafting the week."
    : !availableDates.length
      ? "There are no remaining days in this week to draft."
      : additions.length
        ? `${additions.length} missing priorit${additions.length === 1 ? "y" : "ies"} can be added without moving your saved sessions.`
        : "Your available supporting priorities are already represented, or no safe addition fits this week.";

  return {
    startDate: plan.startDate,
    endDate: plan.endDate,
    today,
    weeklyTrainingDays: preferences.weeklyTrainingDays,
    existingDates,
    weekDates,
    availableDates,
    additions,
    summary,
    rollover,
    preferences,
    capacity,
    adaptation,
    sourceFingerprint: fingerprint,
  };
}

export function validateWeeklyCoachDraftSelection(
  draft: WeeklyCoachDraft,
  additions: WeeklyCoachDraftAddition[],
) {
  if (additions.length > draft.adaptation.additionLimit) {
    return draft.adaptation.additionLimit === 0
      ? "The current coach stance does not allow optional additions. Refresh the week and review the evidence."
      : `Choose no more than ${draft.adaptation.additionLimit} addition${draft.adaptation.additionLimit === 1 ? "" : "s"} for the current coach stance.`;
  }
  const focusIds = additions.map((addition) => addition.focusId);
  if (new Set(focusIds).size !== focusIds.length) return "Each priority can be added only once.";
  if (
    additions.some(
      (addition) =>
        addition.date < draft.today ||
        addition.date < draft.startDate ||
        addition.date > draft.endDate ||
        !draft.availableDates.includes(addition.date),
    )
  ) {
    return "Choose a remaining day in this week.";
  }
  const occupied = new Set([...draft.existingDates, ...additions.map((addition) => addition.date)]);
  if (occupied.size > draft.weeklyTrainingDays) {
    return `This would use ${occupied.size} training days, above your limit of ${draft.weeklyTrainingDays}.`;
  }
  const capacity = projectWeeklyCoachCapacity(draft.capacity, draft.preferences, additions);
  if (capacity.plannedMinutes > capacity.weeklyMinutes) {
    return `This would use about ${capacity.plannedMinutes} minutes, above your limit of ${capacity.weeklyMinutes}.`;
  }
  if (capacity.demandingDays > capacity.maxDemandingDays) {
    return `This would use ${capacity.demandingDays} demanding days, above your limit of ${capacity.maxDemandingDays}.`;
  }
  return null;
}
