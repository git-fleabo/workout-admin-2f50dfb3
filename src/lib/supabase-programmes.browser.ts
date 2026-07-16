import { supabasePublicSelect } from "./supabase-public";

export type ProgrammeTemplateEntry = {
  id: string;
  name: string;
  slotKey: string | null;
  orderIndex: number;
  sets: string | null;
  reps: string | null;
  minSets: number | null;
  maxSets: number | null;
  minReps: number | null;
  maxReps: number | null;
  intensityPercent: number | null;
  percentBase: string | null;
  roundingIncrement: number | null;
  isOptional: boolean;
  weight: string | null;
  duration: string | null;
  rpe: string | null;
  rest: string | null;
  notes: string | null;
};

export type ProgrammeTemplateWorkout = {
  id: string;
  name: string;
  sequenceIndex: number;
  weekNumber: number | null;
  dayNumber: number | null;
  sessionNumber: number | null;
  description: string | null;
  entries: ProgrammeTemplateEntry[];
};

export type ProgrammeTemplate = {
  id: string;
  name: string;
  description: string | null;
  methodType: string | null;
  durationWeeks: number | null;
  sessionsPerWeek: number | null;
  defaultSetChoice: string | null;
  percentBase: string | null;
  roundingIncrement: number | null;
  workouts: ProgrammeTemplateWorkout[];
};

type ProgrammeRecord = {
  id: string;
  name: string;
  description: string | null;
  method_type: string | null;
  duration_weeks: number | null;
  sessions_per_week: number | null;
  default_set_choice: string | null;
  percent_base: string | null;
  rounding_increment: number | string | null;
};

type ProgrammeWorkoutRecord = {
  id: string;
  program_id: string;
  name: string;
  sequence_index: number;
  week_number: number | null;
  day_number: number | null;
  session_number: number | null;
  description: string | null;
};

type ProgrammeEntryRecord = {
  id: string;
  program_workout_id: string;
  name: string;
  slot_key: string | null;
  order_index: number;
  sets: string | null;
  reps: string | null;
  min_sets: number | null;
  max_sets: number | null;
  min_reps: number | null;
  max_reps: number | null;
  intensity_percent: number | string | null;
  percent_base: string | null;
  rounding_increment: number | string | null;
  is_optional: boolean | null;
  weight: string | null;
  duration: string | null;
  rpe: string | null;
  rest: string | null;
  notes: string | null;
};

function numberOrNull(value: number | string | null) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function listProgrammeTemplatesClient(): Promise<ProgrammeTemplate[]> {
  const [programmes, workouts, entries] = await Promise.all([
    supabasePublicSelect<ProgrammeRecord>("programs", {
      select:
        "id,name,description,method_type,duration_weeks,sessions_per_week,default_set_choice,percent_base,rounding_increment",
      is_template: "eq.true",
      order: "name.asc",
    }),
    supabasePublicSelect<ProgrammeWorkoutRecord>("program_workouts", {
      select: "id,program_id,name,sequence_index,week_number,day_number,session_number,description",
      order: "sequence_index.asc",
    }),
    supabasePublicSelect<ProgrammeEntryRecord>("program_workout_entries", {
      select:
        "id,program_workout_id,name,slot_key,order_index,sets,reps,min_sets,max_sets,min_reps,max_reps,intensity_percent,percent_base,rounding_increment,is_optional,weight,duration,rpe,rest,notes",
      order: "order_index.asc",
    }),
  ]);

  const entriesByWorkout = new Map<string, ProgrammeTemplateEntry[]>();
  for (const entry of entries) {
    const list = entriesByWorkout.get(entry.program_workout_id) ?? [];
    list.push({
      id: entry.id,
      name: entry.name,
      slotKey: entry.slot_key,
      orderIndex: entry.order_index,
      sets: entry.sets,
      reps: entry.reps,
      minSets: entry.min_sets,
      maxSets: entry.max_sets,
      minReps: entry.min_reps,
      maxReps: entry.max_reps,
      intensityPercent: numberOrNull(entry.intensity_percent),
      percentBase: entry.percent_base,
      roundingIncrement: numberOrNull(entry.rounding_increment),
      isOptional: entry.is_optional ?? false,
      weight: entry.weight,
      duration: entry.duration,
      rpe: entry.rpe,
      rest: entry.rest,
      notes: entry.notes,
    });
    entriesByWorkout.set(entry.program_workout_id, list);
  }

  const workoutsByProgramme = new Map<string, ProgrammeTemplateWorkout[]>();
  for (const workout of workouts) {
    const list = workoutsByProgramme.get(workout.program_id) ?? [];
    list.push({
      id: workout.id,
      name: workout.name,
      sequenceIndex: workout.sequence_index,
      weekNumber: workout.week_number,
      dayNumber: workout.day_number,
      sessionNumber: workout.session_number,
      description: workout.description,
      entries: (entriesByWorkout.get(workout.id) ?? []).sort(
        (left, right) => left.orderIndex - right.orderIndex,
      ),
    });
    workoutsByProgramme.set(workout.program_id, list);
  }

  return programmes.map((programme) => ({
    id: programme.id,
    name: programme.name,
    description: programme.description,
    methodType: programme.method_type,
    durationWeeks: programme.duration_weeks,
    sessionsPerWeek: programme.sessions_per_week,
    defaultSetChoice: programme.default_set_choice,
    percentBase: programme.percent_base,
    roundingIncrement: numberOrNull(programme.rounding_increment),
    workouts: (workoutsByProgramme.get(programme.id) ?? []).sort(
      (left, right) => left.sequenceIndex - right.sequenceIndex,
    ),
  }));
}
