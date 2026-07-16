import { todayISO } from "./date";
import type { ExerciseHistory, ExerciseSessionPoint, GoalMetric, GoalRow } from "./training-types";

export type GoalActivitySession = {
  id: string;
  date: string;
  minutes: number;
};

export type GoalProgress = {
  value: number | null;
  target: number | null;
  percentage: number | null;
  reached: boolean;
  automatic: boolean;
  measuredAt: string | null;
  sourceLabel: string;
};

export function calculateGoalProgress({
  goal,
  activitySessions,
  exerciseHistory,
}: {
  goal: GoalRow;
  activitySessions?: GoalActivitySession[];
  exerciseHistory?: ExerciseHistory;
}): GoalProgress {
  const target = goal.targetValue ?? positiveNumber(goal.target);
  const periodActivity = (activitySessions ?? []).filter((session) =>
    dateFallsInGoalPeriod(session.date, goal.period),
  );

  if (goal.goalType === "consistency") {
    if (goal.goalMetric === "checkins") {
      const checkins = goal.checkins.filter((checkin) =>
        dateFallsInGoalPeriod(checkin.date, goal.period),
      );
      return progressResult({
        goal,
        value: checkins.length,
        target,
        automatic: false,
        measuredAt: checkins[0]?.date ?? null,
        sourceLabel: "Manual check-ins",
      });
    }

    if (goal.goalMetric === "sessions") {
      return progressResult({
        goal,
        value: activitySessions ? periodActivity.length : null,
        target,
        automatic: true,
        measuredAt: latestDate(periodActivity.map((session) => session.date)),
        sourceLabel: "Completed sessions",
      });
    }

    if (goal.goalMetric === "active_days") {
      return progressResult({
        goal,
        value: activitySessions
          ? new Set(periodActivity.map((session) => session.date)).size
          : null,
        target,
        automatic: true,
        measuredAt: latestDate(periodActivity.map((session) => session.date)),
        sourceLabel: "Active training days",
      });
    }

    if (goal.goalMetric === "minutes") {
      return progressResult({
        goal,
        value: activitySessions
          ? round(
              periodActivity.reduce((total, session) => total + session.minutes, 0),
              1,
            )
          : null,
        target,
        automatic: true,
        measuredAt: latestDate(periodActivity.map((session) => session.date)),
        sourceLabel: "Completed session time",
      });
    }
  }

  if ((goal.goalType === "performance" || goal.goalType === "duration") && goal.goalMetric) {
    const points = (exerciseHistory?.points ?? []).filter((point) =>
      dateFallsInGoalPeriod(point.date, goal.period),
    );
    const measured = exerciseMeasurement(goal.goalMetric, points);
    return progressResult({
      goal,
      value: measured.value,
      target,
      automatic: true,
      measuredAt: measured.date,
      sourceLabel: "Workout history",
    });
  }

  if (goal.goalType === "legacy") {
    const checkins = goal.checkins.filter((checkin) =>
      dateFallsInGoalPeriod(checkin.date, goal.period),
    );
    return progressResult({
      goal,
      value: checkins.length,
      target,
      automatic: false,
      measuredAt: checkins[0]?.date ?? null,
      sourceLabel: "Manual check-ins",
    });
  }

  return progressResult({
    goal,
    value: null,
    target,
    automatic: false,
    measuredAt: null,
    sourceLabel: goal.goalType === "milestone" ? "Manual milestone" : "No measured history",
  });
}

function exerciseMeasurement(metric: GoalMetric, points: ExerciseSessionPoint[]) {
  let best: { value: number; date: string } | null = null;
  const consider = (value: number | null | undefined, date: string) => {
    if (value == null || !Number.isFinite(value) || value <= 0) return;
    if (!best || value > best.value || (value === best.value && date > best.date)) {
      best = { value, date };
    }
  };

  for (const point of points) {
    if (metric === "max_weight") consider(point.maxWeight, point.date);
    if (metric === "estimated_1rm") consider(point.est1RM, point.date);
    if (metric === "reps") consider(bestSetReps(point), point.date);
    if (metric === "hold_seconds") consider(bestHold(point), point.date);
    if (metric === "duration_minutes") consider(activityMinutes(point), point.date);
    if (metric === "distance_km") consider(point.totalDistanceKm, point.date);
    if (metric === "distance_m") consider(point.totalDistanceKm * 1000, point.date);
    if (metric === "rounds") consider(point.rounds, point.date);
    if (metric === "height_cm") consider(point.heightCm, point.date);
    if (metric === "problems") consider(point.problems, point.date);
  }

  return best ?? { value: null, date: null };
}

function bestSetReps(point: ExerciseSessionPoint) {
  return point.sets.reduce<number | null>((best, set) => {
    if (set.reps == null) return best;
    const value =
      set.aggregateSets && set.aggregateSets > 1 ? set.reps / set.aggregateSets : set.reps;
    return best == null || value > best ? value : best;
  }, null);
}

function bestHold(point: ExerciseSessionPoint) {
  return point.sets.reduce<number | null>(
    (best, set) =>
      set.durationSeconds != null && (best == null || set.durationSeconds > best)
        ? set.durationSeconds
        : best,
    null,
  );
}

function activityMinutes(point: ExerciseSessionPoint) {
  return point.activityDurationMinutes > 0 ? point.activityDurationMinutes : point.totalDuration;
}

function progressResult({
  goal,
  value,
  target,
  automatic,
  measuredAt,
  sourceLabel,
}: {
  goal: GoalRow;
  value: number | null;
  target: number | null;
  automatic: boolean;
  measuredAt: string | null;
  sourceLabel: string;
}): GoalProgress {
  const percentage = progressPercentage(value, target, goal.startingValue);
  return {
    value,
    target,
    percentage,
    reached: value != null && target != null && value >= target,
    automatic,
    measuredAt,
    sourceLabel,
  };
}

function progressPercentage(value: number | null, target: number | null, starting: number | null) {
  if (value == null || target == null || target <= 0) return null;
  if (starting != null && target > starting) {
    return Math.min(100, Math.max(0, Math.round(((value - starting) / (target - starting)) * 100)));
  }
  return Math.min(100, Math.max(0, Math.round((value / target) * 100)));
}

export function dateFallsInGoalPeriod(date: string, period: string) {
  const current = new Date(`${todayISO()}T00:00:00`);
  const candidate = new Date(`${date}T00:00:00`);
  const normalizedPeriod = period.toLowerCase();

  if (normalizedPeriod === "week") {
    const day = current.getDay() || 7;
    const start = new Date(current);
    start.setDate(current.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return candidate >= start && candidate < end;
  }
  if (normalizedPeriod === "month") {
    return (
      candidate.getFullYear() === current.getFullYear() &&
      candidate.getMonth() === current.getMonth()
    );
  }
  if (normalizedPeriod === "quarter") {
    return (
      candidate.getFullYear() === current.getFullYear() &&
      Math.floor(candidate.getMonth() / 3) === Math.floor(current.getMonth() / 3)
    );
  }
  if (normalizedPeriod === "year") {
    return candidate.getFullYear() === current.getFullYear();
  }
  return true;
}

function positiveNumber(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function latestDate(dates: string[]) {
  return dates.reduce<string | null>(
    (latest, date) => (!latest || date > latest ? date : latest),
    null,
  );
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
