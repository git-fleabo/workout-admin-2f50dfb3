import { buildGoalReview } from "./goal-review.ts";
import type { GoalActivitySession } from "./goal-progress.ts";
import type { ExerciseHistory, GoalRow } from "./training-types";

function shiftDate(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function buildGoalTrend({
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
  const measured = goal.goalType === "performance" || goal.goalType === "duration";
  const manual = goal.goalType === "legacy" || goal.goalMetric === "checkins";
  const supported = measured
    ? Boolean(goal.exerciseId && goal.goalMetric)
    : manual ||
      (goal.goalType === "consistency" &&
        ["sessions", "active_days", "minutes"].includes(goal.goalMetric));
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const start = shiftDate(weekStart, (index - 3) * 7);
    const fullEnd = shiftDate(start, 6);
    const end = fullEnd < reviewEnd ? fullEnd : reviewEnd;
    const inWeek = (date: string) => date >= start && date <= end;
    const activity = activitySessions?.filter((session) => inWeek(session.date));
    const points = exerciseHistory?.points.filter((point) => inWeek(point.date));
    const checkins = goal.checkins.filter((checkin) => inWeek(checkin.date));
    // A trend compares fresh weekly results across period boundaries. Never carry
    // forward a personal best or divide a monthly/yearly target into weekly targets.
    const review = buildGoalReview({
      goal: { ...goal, period: "static", checkins },
      weekStart: start,
      reviewEnd: end,
      activitySessions: activity,
      exerciseHistory: exerciseHistory ? { ...exerciseHistory, points: points ?? [] } : undefined,
    });
    const missingTime = goal.goalMetric === "minutes" && review.missingMinutes;
    const value =
      missingTime && !review.evidence.some((item) => item.value != null)
        ? null
        : review.progress.value;
    return {
      start,
      end,
      partialWeek: end < fullEnd,
      value,
      missingTime,
      evidence: review.evidence,
      best: review.best,
      sourceCount: measured
        ? (points?.length ?? 0)
        : manual
          ? checkins.length
          : (activity?.length ?? 0),
      missingMeasurements: measured ? (points?.length ?? 0) - review.evidence.length : 0,
    };
  });
  return { goal, weeks, supported, measured, manual };
}

export type GoalTrend = ReturnType<typeof buildGoalTrend>;
