import type { CoachingPreferences } from "./coaching-preferences.ts";
import type { SupportDoseOpportunity } from "./coach-readiness.ts";
import type { SavedWorkoutPlan } from "./supabase-plans.browser.ts";
import type {
  TrainingContext,
  TrainingContextKind,
  TrainingContextSession,
} from "./training-context.ts";
import type { WeeklyPlan } from "./weekly-plan.ts";
import type { WeeklyCoachAdaptation } from "./weekly-coach-adaptation.ts";

export type WeeklyCoachRecommendationType =
  | "move_session"
  | "skip_support_session"
  | "adjust_support_dose";

export type CoachOutcomeRating = "too_easy" | "right" | "too_hard";

export type WeeklyCoachDecisionHistory = {
  weekStart: string;
  recommendationType: WeeklyCoachRecommendationType;
  subjectFocusId: string;
  decision: "accepted" | "rejected";
  proposedDate: string;
  chosenDate: string | null;
  outcomeRating?: CoachOutcomeRating | null;
};

type WeeklyCoachRecommendationBase = {
  key: string;
  type: WeeklyCoachRecommendationType;
  suggestedWorkoutId: string;
  subjectFocusId: string;
  sessionLabel: string;
  fromDate: string;
  proposedDate: string;
  title: string;
  rationale: string;
  learningNote: string | null;
};

export type WeeklyCoachMoveRecommendation = WeeklyCoachRecommendationBase & {
  type: "move_session";
  availableDates: string[];
};

export type WeeklyCoachSkipSupportRecommendation = WeeklyCoachRecommendationBase & {
  type: "skip_support_session";
};

export type WeeklyCoachDoseRecommendation = WeeklyCoachRecommendationBase & {
  type: "adjust_support_dose";
  adjustment: "progress" | "reduce";
  currentSets: number;
  currentValue: number;
  targetSets: number;
  targetValue: number;
  doseUnit: "reps" | "seconds";
};

export type WeeklyCoachRecommendation =
  | WeeklyCoachMoveRecommendation
  | WeeklyCoachSkipSupportRecommendation
  | WeeklyCoachDoseRecommendation;

const DAY_MS = 86_400_000;
const DEMANDING = new Set<TrainingContextKind>(["strength", "climbing", "conditioning"]);

function dayName(date: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

function dayIndex(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function longestConsecutiveRun(dates: string[]) {
  const unique = Array.from(new Set(dates)).sort();
  let longest = 0;
  let current = 0;
  let previous: string | null = null;
  for (const date of unique) {
    const distance = previous
      ? (new Date(`${date}T00:00:00Z`).getTime() - new Date(`${previous}T00:00:00Z`).getTime()) /
        DAY_MS
      : null;
    current = distance === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }
  return longest;
}

function pressureScore(sessions: TrainingContextSession[], preferences: CoachingPreferences) {
  const demandingByDate = new Map<string, TrainingContextSession[]>();
  for (const session of sessions.filter((item) => DEMANDING.has(item.kind))) {
    demandingByDate.set(session.date, [...(demandingByDate.get(session.date) ?? []), session]);
  }
  const overlaps = [...demandingByDate.values()].filter((items) => items.length >= 2).length;
  const demandingDates = [...demandingByDate.keys()];
  const occupiedDates = new Set(sessions.map((session) => session.date)).size;
  return (
    overlaps * 100 +
    Math.max(0, longestConsecutiveRun(demandingDates) - 2) * 20 +
    Math.max(0, demandingDates.length - preferences.maxDemandingDays) * 20 +
    Math.max(0, occupiedDates - preferences.weeklyTrainingDays) * 20
  );
}

function focusRank(session: TrainingContextSession, preferences: CoachingPreferences) {
  if (preferences.maintenanceFocusIds.includes(session.focusId)) return 0;
  if (!preferences.secondaryFocusIds.includes(session.focusId)) {
    return session.focusId === preferences.primaryFocusId ? 3 : 1;
  }
  return 2;
}

function relevantHistory(
  history: WeeklyCoachDecisionHistory[],
  type: WeeklyCoachRecommendationType,
  focusId: string,
  currentWeek: string,
) {
  return history.filter(
    (item) =>
      item.weekStart < currentWeek &&
      item.recommendationType === type &&
      item.subjectFocusId === focusId,
  );
}

function decisionPenalty(history: WeeklyCoachDecisionHistory[]) {
  return history.reduce((score, item) => {
    if (item.decision === "rejected") return score + 20;
    if (item.outcomeRating === "right") return score - 12;
    if (item.outcomeRating === "too_hard") return score + 10;
    if (item.outcomeRating === "too_easy") return score + 4;
    return score - 5;
  }, 0);
}

function preferredDayScore(date: string, history: WeeklyCoachDecisionHistory[]) {
  const target = dayIndex(date);
  return history.reduce((score, item) => {
    if (item.decision !== "accepted" || !item.chosenDate || dayIndex(item.chosenDate) !== target) {
      return score;
    }
    const outcomeWeight =
      item.outcomeRating === "right"
        ? 4
        : item.outcomeRating === "too_hard"
          ? -5
          : item.outcomeRating === "too_easy"
            ? 1
            : item.chosenDate === item.proposedDate
              ? 1
              : 3;
    return score + outcomeWeight;
  }, 0);
}

function moveLearningNote(date: string, history: WeeklyCoachDecisionHistory[]) {
  const matching = history.filter(
    (item) =>
      item.decision === "accepted" &&
      item.chosenDate &&
      item.outcomeRating !== "too_hard" &&
      dayIndex(item.chosenDate) === dayIndex(date),
  );
  if (!matching.length) return null;
  return matching.length === 1
    ? `A previous review favoured ${dayName(date)} for similar work.`
    : `${matching.length} previous reviews favoured ${dayName(date)} for similar work.`;
}

function buildMoveRecommendation({
  context,
  plan,
  preferences,
  history,
}: {
  context: TrainingContext;
  plan: WeeklyPlan;
  preferences: CoachingPreferences;
  history: WeeklyCoachDecisionHistory[];
}): WeeklyCoachMoveRecommendation | null {
  const demandingByDate = new Map<string, TrainingContextSession[]>();
  for (const session of context.sessions.filter((item) => DEMANDING.has(item.kind))) {
    demandingByDate.set(session.date, [...(demandingByDate.get(session.date) ?? []), session]);
  }
  const overlapDates = new Set(
    [...demandingByDate.entries()].filter(([, items]) => items.length >= 2).map(([date]) => date),
  );
  const demandingDates = [...demandingByDate.keys()];
  const hasLongRun = longestConsecutiveRun(demandingDates) >= 3;
  if (!overlapDates.size && !hasLongRun) return null;

  const movable = context.sessions
    .filter(
      (session) =>
        session.source === "scheduled" &&
        !session.completed &&
        DEMANDING.has(session.kind) &&
        (overlapDates.has(session.date) || hasLongRun),
    )
    .sort((left, right) => {
      const leftHistory = relevantHistory(history, "move_session", left.focusId, plan.startDate);
      const rightHistory = relevantHistory(history, "move_session", right.focusId, plan.startDate);
      return (
        Number(!overlapDates.has(left.date)) - Number(!overlapDates.has(right.date)) ||
        decisionPenalty(leftHistory) - decisionPenalty(rightHistory) ||
        focusRank(left, preferences) - focusRank(right, preferences) ||
        left.date.localeCompare(right.date)
      );
    });
  const baselineScore = pressureScore(context.sessions, preferences);

  for (const session of movable) {
    const suggestedWorkoutId = session.id.replace(/^scheduled:/, "");
    const key = `move:${suggestedWorkoutId}:${session.date}`;
    const sessionHistory = relevantHistory(
      history,
      "move_session",
      session.focusId,
      plan.startDate,
    );
    const alternatives = plan.days
      .map((day) => day.date)
      .filter((date) => date !== session.date && !(demandingByDate.get(date)?.length ?? 0))
      .map((date) => {
        const moved = context.sessions.map((item) =>
          item.id === session.id ? { ...item, date } : item,
        );
        const movedOccupiedDays = new Set(moved.map((item) => item.date)).size;
        const movedDemandingDays = new Set(
          moved.filter((item) => DEMANDING.has(item.kind)).map((item) => item.date),
        ).size;
        return {
          date,
          score: pressureScore(moved, preferences),
          preferredDayScore: preferredDayScore(date, sessionHistory),
          capacitySafe:
            movedOccupiedDays <= Math.max(context.occupiedDays, preferences.weeklyTrainingDays) &&
            movedDemandingDays <= Math.max(context.demandingDays, preferences.maxDemandingDays),
          alreadyOccupied: context.sessions.some((item) => item.date === date),
          distance: Math.abs(
            (new Date(`${date}T00:00:00Z`).getTime() -
              new Date(`${session.date}T00:00:00Z`).getTime()) /
              DAY_MS,
          ),
        };
      })
      .filter((option) => option.capacitySafe && option.score < baselineScore)
      .sort(
        (left, right) =>
          left.score - right.score ||
          right.preferredDayScore - left.preferredDayScore ||
          Number(right.alreadyOccupied) - Number(left.alreadyOccupied) ||
          left.distance - right.distance ||
          left.date.localeCompare(right.date),
      );
    if (!alternatives.length) continue;
    const proposedDate = alternatives[0].date;
    const reason = overlapDates.has(session.date)
      ? `${session.label} currently shares ${dayName(session.date)} with other demanding work.`
      : `${session.label} sits inside a run of at least three demanding days.`;
    return {
      key,
      type: "move_session",
      suggestedWorkoutId,
      subjectFocusId: session.focusId,
      sessionLabel: session.label,
      fromDate: session.date,
      proposedDate,
      availableDates: alternatives.map((option) => option.date),
      title: `Move ${session.label} to ${dayName(proposedDate)}`,
      rationale: `${reason} ${dayName(proposedDate)} reduces that pressure without moving a programme session.`,
      learningNote: moveLearningNote(proposedDate, sessionHistory),
    };
  }
  return null;
}

function buildSkipSupportRecommendation({
  context,
  plan,
  preferences,
  scheduledPlans,
  history,
  preferOptionalReduction = false,
}: {
  context: TrainingContext;
  plan: WeeklyPlan;
  preferences: CoachingPreferences;
  scheduledPlans: SavedWorkoutPlan[];
  history: WeeklyCoachDecisionHistory[];
  preferOptionalReduction?: boolean;
}): WeeklyCoachSkipSupportRecommendation | null {
  if (!preferOptionalReduction && context.occupiedDays <= preferences.weeklyTrainingDays) {
    return null;
  }
  const planById = new Map(scheduledPlans.map((item) => [item.suggestedWorkoutId, item]));
  const sessionsByDate = new Map<string, TrainingContextSession[]>();
  for (const session of context.sessions) {
    sessionsByDate.set(session.date, [...(sessionsByDate.get(session.date) ?? []), session]);
  }
  const candidates = context.sessions
    .filter((session) => {
      if (
        session.source !== "scheduled" ||
        session.completed ||
        !preferences.maintenanceFocusIds.includes(session.focusId) ||
        (!preferOptionalReduction && (sessionsByDate.get(session.date)?.length ?? 0) !== 1)
      ) {
        return false;
      }
      const saved = planById.get(session.id.replace(/^scheduled:/, ""));
      return Boolean(
        saved?.programAssignmentId &&
        !saved.programWorkoutId &&
        (saved.goalId || saved.mobilityRunId) &&
        (saved.status === "pending" || saved.status === "accepted"),
      );
    })
    .sort((left, right) => {
      const leftHistory = relevantHistory(
        history,
        "skip_support_session",
        left.focusId,
        plan.startDate,
      );
      const rightHistory = relevantHistory(
        history,
        "skip_support_session",
        right.focusId,
        plan.startDate,
      );
      return (
        decisionPenalty(leftHistory) - decisionPenalty(rightHistory) ||
        right.date.localeCompare(left.date)
      );
    });
  const session = candidates[0];
  if (!session) return null;
  const suggestedWorkoutId = session.id.replace(/^scheduled:/, "");
  const sessionHistory = relevantHistory(
    history,
    "skip_support_session",
    session.focusId,
    plan.startDate,
  );
  const rejected = sessionHistory.filter((item) => item.decision === "rejected").length;
  return {
    key: `skip-support:${suggestedWorkoutId}:${session.date}`,
    type: "skip_support_session",
    suggestedWorkoutId,
    subjectFocusId: session.focusId,
    sessionLabel: session.label,
    fromDate: session.date,
    proposedDate: session.date,
    title: `Skip ${session.label} this week`,
    rationale: preferOptionalReduction
      ? `Recovery, adherence, capacity or a recent outcome calls for a protective week. Skipping this maintenance session removes one optional demand without changing your strength programme or higher priorities.`
      : `Your saved week currently uses ${context.occupiedDays} training days, above your limit of ${preferences.weeklyTrainingDays}. Skipping this maintenance session frees one complete day without changing your strength programme or higher priorities.`,
    learningNote: rejected
      ? `You declined ${rejected} similar reduction${rejected === 1 ? "" : "s"}; this appears only because no safe schedule move resolves the limit.`
      : null,
  };
}

function buildDoseRecommendation({
  opportunities,
  plan,
  preferences,
  history,
}: {
  opportunities: SupportDoseOpportunity[];
  plan: WeeklyPlan;
  preferences: CoachingPreferences;
  history: WeeklyCoachDecisionHistory[];
}): WeeklyCoachDoseRecommendation | null {
  const ranked = [...opportunities].sort((left, right) => {
    const leftHistory = relevantHistory(
      history,
      "adjust_support_dose",
      left.subjectFocusId,
      plan.startDate,
    );
    const rightHistory = relevantHistory(
      history,
      "adjust_support_dose",
      right.subjectFocusId,
      plan.startDate,
    );
    const focusPriority = (item: SupportDoseOpportunity) => {
      if (item.adjustment === "reduce") {
        if (preferences.maintenanceFocusIds.includes(item.subjectFocusId)) return 0;
        if (preferences.secondaryFocusIds.includes(item.subjectFocusId)) return 1;
        return 2;
      }
      if (item.subjectFocusId === preferences.primaryFocusId) return 0;
      if (preferences.secondaryFocusIds.includes(item.subjectFocusId)) return 1;
      if (preferences.maintenanceFocusIds.includes(item.subjectFocusId)) return 2;
      return 3;
    };
    const outcomePenalty = (
      item: SupportDoseOpportunity,
      itemHistory: WeeklyCoachDecisionHistory[],
    ) =>
      itemHistory.reduce((score, review) => {
        if (review.decision === "rejected") return score;
        if (item.adjustment === "progress") {
          if (review.outcomeRating === "too_hard") return score + 35;
          if (review.outcomeRating === "right") return score - 10;
          if (review.outcomeRating === "too_easy") return score - 15;
        } else {
          if (review.outcomeRating === "too_hard") return score - 15;
          if (review.outcomeRating === "right") return score + 5;
          if (review.outcomeRating === "too_easy") return score + 15;
        }
        return score;
      }, 0);
    return (
      decisionPenalty(leftHistory) - decisionPenalty(rightHistory) ||
      outcomePenalty(left, leftHistory) - outcomePenalty(right, rightHistory) ||
      focusPriority(left) - focusPriority(right) ||
      left.date.localeCompare(right.date)
    );
  });
  const opportunity = ranked[0];
  if (!opportunity) return null;
  const opportunityHistory = relevantHistory(
    history,
    "adjust_support_dose",
    opportunity.subjectFocusId,
    plan.startDate,
  );
  const accepted = opportunityHistory.filter((item) => item.decision === "accepted").length;
  const rejected = opportunityHistory.filter((item) => item.decision === "rejected").length;
  const outcomes = opportunityHistory.filter((item) => item.outcomeRating).length;
  const learningNote =
    accepted || rejected
      ? `${accepted} similar dose review${accepted === 1 ? "" : "s"} accepted · ${rejected} declined${outcomes ? ` · ${outcomes} outcome${outcomes === 1 ? "" : "s"} reviewed` : ""}.`
      : null;
  return {
    key: `dose:${opportunity.adjustment}:${opportunity.suggestedWorkoutId}:${opportunity.date}`,
    type: "adjust_support_dose",
    suggestedWorkoutId: opportunity.suggestedWorkoutId,
    subjectFocusId: opportunity.subjectFocusId,
    sessionLabel: opportunity.sessionLabel,
    fromDate: opportunity.date,
    proposedDate: opportunity.date,
    title:
      opportunity.adjustment === "progress"
        ? `Progress ${opportunity.sessionLabel}`
        : `Reduce ${opportunity.sessionLabel}`,
    rationale: opportunity.rationale,
    learningNote,
    adjustment: opportunity.adjustment,
    currentSets: opportunity.currentSets,
    currentValue: opportunity.currentValue,
    targetSets: opportunity.targetSets,
    targetValue: opportunity.targetValue,
    doseUnit: opportunity.doseUnit,
  };
}

export function buildWeeklyCoachRecommendation({
  context,
  plan,
  preferences,
  scheduledPlans = [],
  doseOpportunities = [],
  decidedKeys = [],
  history = [],
  adaptation,
}: {
  context: TrainingContext;
  plan: WeeklyPlan;
  preferences: CoachingPreferences;
  scheduledPlans?: SavedWorkoutPlan[];
  doseOpportunities?: SupportDoseOpportunity[];
  decidedKeys?: string[];
  history?: WeeklyCoachDecisionHistory[];
  adaptation?: WeeklyCoachAdaptation;
}): WeeklyCoachRecommendation | null {
  if (!preferences.saved || decidedKeys.length > 0) return null;
  const move = buildMoveRecommendation({ context, plan, preferences, history });
  const skip = buildSkipSupportRecommendation({
    context,
    plan,
    preferences,
    scheduledPlans,
    history,
    preferOptionalReduction: adaptation?.preferOptionalReduction,
  });
  const dose = (adjustment?: SupportDoseOpportunity["adjustment"]) =>
    buildDoseRecommendation({
      opportunities: adjustment
        ? doseOpportunities.filter((item) => item.adjustment === adjustment)
        : doseOpportunities,
      plan,
      preferences,
      history,
    });

  if (adaptation?.mode === "protect") return move ?? dose("reduce") ?? skip;
  if (adaptation?.mode === "maintain") return move ?? skip;
  if (adaptation?.mode === "build") return move ?? skip ?? dose("progress");
  return move ?? skip ?? dose();
}
