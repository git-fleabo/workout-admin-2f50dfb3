import type { CoachingPreferences } from "./coaching-preferences.ts";
import type {
  TrainingContext,
  TrainingContextKind,
  TrainingContextSession,
} from "./training-context.ts";
import type { WeeklyPlan } from "./weekly-plan.ts";

export type WeeklyCoachRecommendation = {
  key: string;
  type: "move_session";
  suggestedWorkoutId: string;
  sessionLabel: string;
  fromDate: string;
  proposedDate: string;
  availableDates: string[];
  title: string;
  rationale: string;
};

const DAY_MS = 86_400_000;
const DEMANDING = new Set<TrainingContextKind>(["strength", "climbing", "conditioning"]);

function dayName(date: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
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

export function buildWeeklyCoachRecommendation({
  context,
  plan,
  preferences,
  decidedKeys = [],
}: {
  context: TrainingContext;
  plan: WeeklyPlan;
  preferences: CoachingPreferences;
  decidedKeys?: string[];
}): WeeklyCoachRecommendation | null {
  if (!preferences.saved || decidedKeys.length > 0) return null;
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
    .sort(
      (left, right) =>
        Number(!overlapDates.has(left.date)) - Number(!overlapDates.has(right.date)) ||
        focusRank(left, preferences) - focusRank(right, preferences) ||
        left.date.localeCompare(right.date),
    );
  const baselineScore = pressureScore(context.sessions, preferences);

  for (const session of movable) {
    const suggestedWorkoutId = session.id.replace(/^scheduled:/, "");
    const key = `move:${suggestedWorkoutId}:${session.date}`;
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
      sessionLabel: session.label,
      fromDate: session.date,
      proposedDate,
      availableDates: alternatives.map((option) => option.date),
      title: `Move ${session.label} to ${dayName(proposedDate)}`,
      rationale: `${reason} ${dayName(proposedDate)} reduces that pressure without moving a programme session.`,
    };
  }
  return null;
}
