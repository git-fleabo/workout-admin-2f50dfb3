import { supabasePublicSelect } from "./supabase-public";
import { getCurrentPerson } from "./supabase-people.browser";
import {
  comparePlannedActual,
  type PlannedActualComparison,
  type PlannedActualSet,
} from "./planned-actual";
import type { ExerciseHistory, ExerciseSessionPoint } from "./training-types";

type EntrySetRecord = {
  set_number: number | null;
  reps: number | string | null;
  weight: number | string | null;
  duration_seconds: number | string | null;
  rpe: number | string | null;
  completed: boolean | null;
};

type SessionEntryRecord = {
  id: string;
  name: string;
  completed: boolean;
  sessions: {
    id: string;
    session_date: string;
    source_sheet: string | null;
    training_locations: {
      name: string;
      kind: "home" | "gym" | "other";
    } | null;
  } | null;
  entry_sets: EntrySetRecord[] | null;
};

type ExerciseHistoryTarget = {
  id?: string;
  name: string;
};

type LoggedExerciseRecord = {
  exercise_id: string | null;
  name: string;
};

type SuggestedSetRecord = {
  set_number: number | string;
  reps: number | string | null;
  weight: number | string | null;
  rpe: number | string | null;
  completed: boolean;
};

type SuggestedEntryRecord = {
  id: string;
  exercise_id: string | null;
  name: string;
  suggested_workout_sets: SuggestedSetRecord[] | null;
};

type CompletedSuggestionRecord = {
  id: string;
  title: string;
  completed_session_id: string;
  suggested_workout_entries: SuggestedEntryRecord[] | null;
};

type ActualPlannedEntryRecord = {
  id: string;
  session_id: string;
  exercise_id: string | null;
  name: string;
  sessions: {
    session_date: string;
    training_locations: { kind: "home" | "gym" | "other" } | null;
  } | null;
  entry_sets: EntrySetRecord[] | null;
};

export type LoggedExerciseKeys = {
  ids: string[];
  names: string[];
};

export async function getLoggedExerciseKeysClient(): Promise<LoggedExerciseKeys> {
  const person = await getCurrentPerson();
  if (!person) throw new Error("This account is not linked to a training profile.");

  const rows = await supabasePublicSelect<LoggedExerciseRecord>("session_entries", {
    select: "exercise_id,name,sessions!inner(person_id,source_sheet,completed)",
    completed: "eq.true",
    source_sheet: "eq.Workout Log",
    "sessions.person_id": `eq.${person.id}`,
    "sessions.source_sheet": "eq.Workout Log",
    "sessions.completed": "eq.true",
    limit: 5000,
  });

  return {
    ids: Array.from(new Set(rows.flatMap((row) => (row.exercise_id ? [row.exercise_id] : [])))),
    names: Array.from(new Set(rows.map((row) => row.name.trim().toLowerCase()).filter(Boolean))),
  };
}

function comparisonSet(row: SuggestedSetRecord | EntrySetRecord, index: number): PlannedActualSet {
  const setNumber = toNumber(row.set_number);
  const reps = toNumber(row.reps);
  const weight = toNumber(row.weight);
  const rpe = toNumber(row.rpe);
  return {
    setNumber: Number.isFinite(setNumber) ? Math.round(setNumber) : index + 1,
    reps: Number.isFinite(reps) ? reps : null,
    weight: Number.isFinite(weight) ? weight : null,
    rpe: Number.isFinite(rpe) ? rpe : null,
    completed: row.completed !== false,
  };
}

function matchesExercise(
  row: { exercise_id: string | null; name: string },
  exercise: ExerciseHistoryTarget,
) {
  return Boolean(
    (exercise.id && row.exercise_id === exercise.id) ||
    row.name.trim().toLowerCase() === exercise.name.trim().toLowerCase(),
  );
}

export async function getPlannedActualComparisonsClient(
  exercise: ExerciseHistoryTarget,
): Promise<PlannedActualComparison[]> {
  const person = await getCurrentPerson();
  if (!person) throw new Error("This account is not linked to a training profile.");

  const suggestions = await supabasePublicSelect<CompletedSuggestionRecord>("suggested_workouts", {
    select:
      "id,title,completed_session_id,suggested_workout_entries(id,exercise_id,name,suggested_workout_sets(set_number,reps,weight,rpe,completed))",
    person_id: `eq.${person.id}`,
    status: "eq.completed",
    completed_session_id: "not.is.null",
    order: "created_at.desc",
    limit: 100,
  });
  const relevant = suggestions.flatMap((suggestion) =>
    (suggestion.suggested_workout_entries ?? [])
      .filter((entry) => matchesExercise(entry, exercise))
      .map((entry) => ({ suggestion, entry })),
  );
  if (!relevant.length) return [];

  const sessionIds = Array.from(
    new Set(relevant.map(({ suggestion }) => suggestion.completed_session_id)),
  );
  const actualEntries = await supabasePublicSelect<ActualPlannedEntryRecord>("session_entries", {
    select:
      "id,session_id,exercise_id,name,sessions!inner(session_date,training_locations(kind)),entry_sets(set_number,reps,weight,rpe,completed)",
    session_id: `in.(${sessionIds.join(",")})`,
    completed: "eq.true",
    source_sheet: "eq.Workout Log",
    limit: 1000,
  });

  return relevant
    .flatMap(({ suggestion, entry }) => {
      const actual = actualEntries.find(
        (row) =>
          row.session_id === suggestion.completed_session_id && matchesExercise(row, exercise),
      );
      if (!actual?.sessions?.session_date) return [];
      const plannedSets = [...(entry.suggested_workout_sets ?? [])]
        .sort((a, b) => toNumber(a.set_number) - toNumber(b.set_number))
        .map(comparisonSet);
      const actualSets = [...(actual.entry_sets ?? [])]
        .sort((a, b) => toNumber(a.set_number) - toNumber(b.set_number))
        .map(comparisonSet);
      return [
        comparePlannedActual({
          id: `${suggestion.id}:${entry.id}`,
          planTitle: suggestion.title,
          sessionId: suggestion.completed_session_id,
          date: actual.sessions.session_date,
          locationKind: actual.sessions.training_locations?.kind ?? null,
          planned: plannedSets,
          actual: actualSets,
        }),
      ];
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

const toNumber = (value: unknown): number => {
  if (value == null || value === "") return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
};

function repsPerSet(totalReps: number, sets: number) {
  if (!Number.isFinite(totalReps) || totalReps <= 0) return null;
  if (!Number.isFinite(sets) || sets <= 0) return Math.ceil(totalReps);
  return Math.ceil(totalReps / sets);
}

function blankPoint(row: SessionEntryRecord): ExerciseSessionPoint {
  return {
    sessionId: row.sessions?.id ?? row.id,
    date: row.sessions?.session_date ?? "",
    locationName: row.sessions?.training_locations?.name ?? null,
    locationKind: row.sessions?.training_locations?.kind ?? null,
    sessions: 0,
    totalReps: 0,
    totalVolume: 0,
    maxWeight: null,
    totalDuration: 0,
    est1RM: null,
    sets: [],
  };
}

export async function getExerciseHistoryClient(
  exercise: ExerciseHistoryTarget,
): Promise<ExerciseHistory> {
  const params: Record<string, string | number | boolean> = {
    select:
      "id,name,completed,sessions!inner(id,session_date,source_sheet,training_locations(name,kind)),entry_sets(set_number,reps,weight,duration_seconds,rpe,completed)",
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

  const bySession = new Map<string, ExerciseSessionPoint>();
  let anyWeight = false;
  let anyReps = false;
  let anyDuration = false;
  let totalRows = 0;

  for (const row of rows) {
    const date = row.sessions?.session_date;
    if (!date) continue;
    const sessionId = row.sessions?.id ?? row.id;
    const sets = row.entry_sets?.length ? row.entry_sets : [{} as EntrySetRecord];
    const individualSets = sets.length > 1 || toNumber(sets[0]?.set_number) <= 1;
    const point = bySession.get(sessionId) ?? blankPoint(row);
    point.sessions += 1;
    totalRows += 1;

    for (const set of sets) {
      const setsKnown = Number.isFinite(toNumber(set.set_number)) && toNumber(set.set_number) > 0;
      const reps = toNumber(set.reps);
      const weight = toNumber(set.weight);
      const durationSeconds = toNumber(set.duration_seconds);
      const rpe = toNumber(set.rpe);

      const repsN = Number.isFinite(reps) && reps > 0 ? reps : null;
      const weightN = Number.isFinite(weight) && weight > 0 ? weight : null;
      const durationMinutes =
        Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds / 60 : 0;
      const aggregateSets =
        !individualSets && setsKnown ? Math.max(1, Math.round(toNumber(set.set_number))) : null;

      point.sets.push({
        setNumber: individualSets && setsKnown ? Math.round(toNumber(set.set_number)) : null,
        reps: repsN,
        weight: weightN,
        rpe: Number.isFinite(rpe) && rpe > 0 ? rpe : null,
        completed: set.completed !== false,
        aggregateSets,
      });

      if (weightN != null) anyWeight = true;
      if (repsN != null) anyReps = true;
      if (durationMinutes > 0) anyDuration = true;

      if (repsN != null) point.totalReps += repsN;
      point.totalDuration += durationMinutes;
      if (weightN != null) {
        if (point.maxWeight == null || weightN > point.maxWeight) point.maxWeight = weightN;
        if (repsN != null) {
          point.totalVolume += repsN * weightN;
          const perSetReps = individualSets
            ? repsN
            : repsPerSet(repsN, setsKnown ? toNumber(set.set_number) : NaN);
          if (perSetReps != null) {
            const est = weightN * (1 + perSetReps / 30);
            if (point.est1RM == null || est > point.est1RM) point.est1RM = est;
          }
        }
      }
    }

    bySession.set(sessionId, point);
  }

  const points = Array.from(bySession.values()).sort((a, b) =>
    a.date === b.date ? a.sessionId.localeCompare(b.sessionId) : a.date.localeCompare(b.date),
  );
  for (const point of points) {
    point.sets.sort(
      (a, b) => (a.setNumber ?? Number.MAX_SAFE_INTEGER) - (b.setNumber ?? Number.MAX_SAFE_INTEGER),
    );
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
