import { supabasePublicSelect } from "./supabase-public";
import type { ExerciseHistory, ExerciseSessionPoint } from "./training-types";

type EntrySetRecord = {
  set_number: number | null;
  reps: number | string | null;
  weight: number | string | null;
  duration_seconds: number | string | null;
};

type SessionEntryRecord = {
  id: string;
  name: string;
  completed: boolean;
  sessions: {
    session_date: string;
    source_sheet: string | null;
  } | null;
  entry_sets: EntrySetRecord[] | null;
};

type ExerciseHistoryTarget = {
  id?: string;
  name: string;
};

const toNumber = (value: unknown): number => {
  if (value == null || value === "") return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
};

function blankPoint(date: string): ExerciseSessionPoint {
  return {
    date,
    sessions: 0,
    totalReps: 0,
    totalVolume: 0,
    maxWeight: null,
    totalDuration: 0,
    est1RM: null,
  };
}

export async function getExerciseHistoryClient(
  exercise: ExerciseHistoryTarget,
): Promise<ExerciseHistory> {
  const params: Record<string, string | number | boolean> = {
    select:
      "id,name,completed,sessions!inner(session_date,source_sheet),entry_sets(set_number,reps,weight,duration_seconds)",
    completed: "eq.true",
    source_sheet: "eq.Workout Log",
    "sessions.source_sheet": "eq.Workout Log",
    limit: 1000,
  };
  if (exercise.id) {
    params.exercise_id = `eq.${exercise.id}`;
  } else {
    params.name = `eq.${exercise.name}`;
  }

  const rows = await supabasePublicSelect<SessionEntryRecord>("session_entries", params);

  const byDate = new Map<string, ExerciseSessionPoint>();
  let anyWeight = false;
  let anyReps = false;
  let anyDuration = false;
  let totalRows = 0;

  for (const row of rows) {
    const date = row.sessions?.session_date;
    if (!date) continue;
    const sets = row.entry_sets?.length ? row.entry_sets : [{} as EntrySetRecord];
    const point = byDate.get(date) ?? blankPoint(date);
    point.sessions += 1;
    totalRows += 1;

    for (const set of sets) {
      const setsKnown = Number.isFinite(toNumber(set.set_number)) && toNumber(set.set_number) > 0;
      const reps = toNumber(set.reps);
      const weight = toNumber(set.weight);
      const durationSeconds = toNumber(set.duration_seconds);

      const repsN = Number.isFinite(reps) && reps > 0 ? reps : null;
      const weightN = Number.isFinite(weight) && weight > 0 ? weight : null;
      const durationMinutes =
        Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds / 60 : 0;

      if (weightN != null) anyWeight = true;
      if (repsN != null) anyReps = true;
      if (durationMinutes > 0) anyDuration = true;

      if (repsN != null) point.totalReps += repsN;
      point.totalDuration += durationMinutes;
      if (weightN != null) {
        if (point.maxWeight == null || weightN > point.maxWeight) point.maxWeight = weightN;
        if (repsN != null) {
          point.totalVolume += repsN * weightN;
          if (setsKnown) {
            const perSetReps = repsN / toNumber(set.set_number);
            if (perSetReps > 0) {
              const est = weightN * (1 + perSetReps / 30);
              if (point.est1RM == null || est > point.est1RM) point.est1RM = est;
            }
          }
        }
      }
    }

    byDate.set(date, point);
  }

  const points = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  for (const point of points) {
    point.totalVolume = Math.round(point.totalVolume);
    point.totalDuration = Math.round(point.totalDuration * 10) / 10;
    if (point.est1RM != null) point.est1RM = Math.round(point.est1RM * 10) / 10;
  }

  const anyEst1RM = points.some((p) => p.est1RM != null);
  const anyVolume = points.some((p) => p.totalVolume > 0);
  const latest1RM = [...points].reverse().find((p) => p.est1RM != null)?.est1RM ?? null;
  const best1RM = points.reduce<number | null>(
    (max, p) => (p.est1RM != null && (max == null || p.est1RM > max) ? p.est1RM : max),
    null,
  );
  const maxWeight = points.reduce<number | null>(
    (max, p) => (p.maxWeight != null && (max == null || p.maxWeight > max) ? p.maxWeight : max),
    null,
  );

  const now = Date.now();
  const fourWeeks = 28 * 86400000;
  const inWindow = (iso: string, fromAgo: number, toAgo: number) => {
    const time = new Date(`${iso}T00:00:00Z`).getTime();
    return time >= now - fromAgo && time < now - toAgo;
  };
  const bestIn = (fromAgo: number, toAgo: number): number | null => {
    let best: number | null = null;
    for (const point of points) {
      if (!inWindow(point.date, fromAgo, toAgo)) continue;
      const value = point.est1RM ?? point.maxWeight;
      if (value != null && (best == null || value > best)) best = value;
    }
    return best;
  };
  const recent = bestIn(fourWeeks, 0);
  const prior = bestIn(2 * fourWeeks, fourWeeks);
  const fourWeekChange =
    recent != null && prior != null && prior !== 0
      ? Math.round(((recent - prior) / prior) * 1000) / 10
      : null;

  return {
    name: exercise.name,
    totalSessions: points.length,
    totalRows,
    points,
    available: {
      weight: anyWeight,
      reps: anyReps,
      duration: anyDuration,
      est1RM: anyEst1RM,
      volume: anyVolume,
    },
    stats: {
      latest1RM,
      best1RM,
      maxWeight,
      fourWeekChange,
    },
  };
}
