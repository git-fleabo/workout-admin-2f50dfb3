import {
  calculateGoalProgress,
  dateFallsInGoalPeriod,
  goalExerciseMeasurement,
} from "./goal-progress.ts";
import type { GoalActivitySession } from "./goal-progress.ts";
import type { ExerciseHistory, GoalRow } from "./training-types";

export type GoalReviewEvidence = {
  id: string;
  date: string;
  sessionId: string | null;
  value: number | null;
  note: string;
};

// Review uses the existing goal rules, anchored to the selected review's end.
// The current saved goal settings are not historical snapshots.
export function buildGoalReview({
  goal,
  weekStart,
  reviewEnd,
  activitySessions,
  exerciseHistory,
}: {
  goal: GoalRow;
  weekStart: string;
  reviewEnd: string;
  activitySessions?: GoalActivitySession[];
  exerciseHistory?: ExerciseHistory;
}) {
  const inPeriod = (date: string) => dateFallsInGoalPeriod(date, goal.period, reviewEnd);
  const checkins = goal.checkins.filter((item) => inPeriod(item.date));
  const points = exerciseHistory?.points.filter((item) => inPeriod(item.date)) ?? [];
  const activity = activitySessions?.filter((item) => inPeriod(item.date));
  const measured = goal.goalType === "performance" || goal.goalType === "duration";
  const manual = goal.goalType === "legacy" || goal.goalMetric === "checkins";
  // Unstructured legacy targets can contain grades or prose. Never parse them as counts.
  const reviewGoal =
    goal.goalType === "legacy"
      ? { ...goal, checkins, target: "", targetValue: null, startingValue: null }
      : { ...goal, checkins };
  const progress = calculateGoalProgress({
    goal: reviewGoal,
    asOf: reviewEnd,
    activitySessions: activity,
    exerciseHistory,
  });
  const previous = calculateGoalProgress({
    goal: { ...reviewGoal, checkins: checkins.filter((item) => item.date < weekStart) },
    asOf: reviewEnd,
    activitySessions: activity?.filter((item) => item.date < weekStart),
    exerciseHistory: exerciseHistory
      ? { ...exerciseHistory, points: points.filter((item) => item.date < weekStart) }
      : undefined,
  });
  const evidence: GoalReviewEvidence[] = measured
    ? points.flatMap((point) => {
        if (!goal.goalMetric) return [];
        const measurement = goalExerciseMeasurement(goal.goalMetric, [point]);
        return measurement.value == null
          ? []
          : [
              {
                id: point.sessionId,
                sessionId: point.sessionId,
                date: point.date,
                value: measurement.value,
                note: point.locationName ?? "Workout history",
              },
            ];
      })
    : manual
      ? checkins.map((checkin) => ({
          id: checkin.id,
          date: checkin.date,
          sessionId: null,
          value: null,
          note: checkin.note || "Manual check-in",
        }))
      : goal.goalType === "consistency"
        ? (activity ?? []).map((session) => ({
            id: session.id,
            sessionId: session.id,
            date: session.date,
            value: goal.goalMetric === "minutes" && session.minutes > 0 ? session.minutes : null,
            note:
              goal.goalMetric === "minutes" && session.minutes <= 0
                ? "Completed session · duration not recorded"
                : "Completed session",
          }))
        : [];
  evidence.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const thisWeekEvidence = evidence.filter((item) => item.date >= weekStart);
  const starting = measured ? goal.startingValue : null;
  const before = previous.value ?? starting;
  const change =
    progress.value != null && before != null
      ? Math.round((progress.value - before) * 100) / 100
      : null;
  const missingMinutes =
    goal.goalMetric === "minutes" && (activity ?? []).some((item) => item.minutes <= 0);
  const missingMetricThisWeek =
    measured && points.some((point) => point.date >= weekStart) && !thisWeekEvidence.length;
  const latest = evidence[0] ?? null;
  const best = measured
    ? (evidence.find(
        (item) => item.date === progress.measuredAt && item.value === progress.value,
      ) ?? null)
    : null;
  return {
    goal,
    progress,
    starting,
    change,
    evidence,
    thisWeekEvidence,
    latest,
    best,
    measured,
    manual,
    missingMinutes,
    missingMetricThisWeek,
    changeFromStarting: measured && previous.value == null && starting != null,
  };
}

export function formatGoalReviewValue(value: number | null, unit: string) {
  if (value == null) return "Not recorded";
  const singular: Record<string, string> = {
    sessions: "session",
    days: "day",
    minutes: "minute",
    seconds: "second",
    reps: "rep",
    "check-ins": "check-in",
    rounds: "round",
    problems: "problem",
    metres: "metre",
  };
  const label = Math.abs(value) === 1 ? (singular[unit] ?? unit) : unit;
  return `${value.toLocaleString("en-GB", { maximumFractionDigits: 2 })}${label ? ` ${label}` : ""}`;
}

export function goalReviewSummary(review: ReturnType<typeof buildGoalReview>) {
  if (review.missingMetricThisWeek)
    return "The exercise was logged this week, but the selected metric was not recorded. Add that measurement to assess progress.";
  if (!review.measured)
    return `${review.thisWeekEvidence.length} ${review.manual ? "check-in" : "completed session"}${review.thisWeekEvidence.length === 1 ? "" : "s"} recorded during this review week.`;
  if (!review.latest)
    return "No measurement for this metric in the goal period. Log a measured result to assess progress.";
  if (!review.thisWeekEvidence.length)
    return "No new measurement in this review week. The best result above is from an earlier log. A fresh measurement will show whether your result has changed.";
  if (review.change == null)
    return "First recorded result in this goal period. Add a starting point in Goals for a baseline comparison.";
  if (review.change === 0)
    return "No increase in the best recorded result during this review week.";
  const change = `${review.change > 0 ? "+" : ""}${formatGoalReviewValue(review.change, review.goal.targetUnit)}`;
  return `Best result changed by ${change} ${review.changeFromStarting ? "from your saved starting point" : "during this review week"}.`;
}

export const GOAL_REVIEW_PERIOD_LABELS: Record<string, string> = {
  week: "Weekly goal",
  month: "Monthly goal",
  quarter: "Quarterly goal",
  year: "Yearly goal",
  static: "Long-term goal",
};
