import {
  supabasePublicDelete,
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import { getProgrammeMethodSetup } from "./programme-methods";
import { getCurrentPerson } from "./supabase-people.browser";
import type { PlannerLocation, WorkoutPlanDraft, WorkoutPlanMovement } from "./workout-plan";

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

export type ProgrammeAssignmentStatus = "active" | "paused" | "complete" | "archived";

export type ProgrammeAssignmentExercise = {
  id: string;
  slotKey: string;
  exerciseId: string | null;
  exerciseName: string;
  trainingMax: number | null;
};

export type ProgrammeAssignment = {
  id: string;
  programId: string;
  personId: string;
  status: ProgrammeAssignmentStatus;
  currentWorkoutIndex: number;
  startedOn: string | null;
  completedOn: string | null;
  notes: string | null;
  createdAt: string;
  exercises: ProgrammeAssignmentExercise[];
};

export type ProgrammeAssignmentInput = {
  programId: string;
  personId: string;
  status: "active" | "paused";
  startedOn: string;
  notes: string;
  exercises: Array<{
    slotKey: string;
    exerciseId: string;
    exerciseName: string;
    trainingMax: number | null;
  }>;
};

export type ProgrammeWorkoutOffer = {
  assignmentId: string;
  programWorkoutId: string;
  programmeName: string;
  workoutName: string;
  workoutNumber: number;
  totalWorkouts: number;
  weekNumber: number | null;
  sessionNumber: number | null;
  methodType: string;
  basis: string;
  movements: WorkoutPlanMovement[];
  exerciseIds: string[];
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

type ProgrammeAssignmentExerciseRecord = {
  id: string;
  slot_key: string;
  exercise_id: string | null;
  exercise_name: string;
  training_max: number | string | null;
};

type ProgrammeAssignmentRecord = {
  id: string;
  program_id: string;
  person_id: string;
  assigned_by_person_id: string | null;
  status: ProgrammeAssignmentStatus;
  current_workout_index: number;
  started_on: string | null;
  completed_on: string | null;
  notes: string | null;
  created_at: string;
  program_assignment_exercises?: ProgrammeAssignmentExerciseRecord[] | null;
};

type LinkedSuggestedWorkoutRecord = {
  id: string;
  program_assignment_id: string | null;
  program_workout_id: string | null;
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

function mapAssignment(row: ProgrammeAssignmentRecord): ProgrammeAssignment {
  return {
    id: row.id,
    programId: row.program_id,
    personId: row.person_id,
    status: row.status,
    currentWorkoutIndex: row.current_workout_index,
    startedOn: row.started_on,
    completedOn: row.completed_on,
    notes: row.notes,
    createdAt: row.created_at,
    exercises: (row.program_assignment_exercises ?? [])
      .map((exercise) => ({
        id: exercise.id,
        slotKey: exercise.slot_key,
        exerciseId: exercise.exercise_id,
        exerciseName: exercise.exercise_name,
        trainingMax: numberOrNull(exercise.training_max),
      }))
      .sort((left, right) => left.slotKey.localeCompare(right.slotKey)),
  };
}

export async function listProgrammeAssignmentsClient(): Promise<ProgrammeAssignment[]> {
  const rows = await supabasePublicSelect<ProgrammeAssignmentRecord>("program_assignments", {
    select:
      "id,program_id,person_id,assigned_by_person_id,status,current_workout_index,started_on,completed_on,notes,created_at,program_assignment_exercises(id,slot_key,exercise_id,exercise_name,training_max)",
    status: "in.(active,paused)",
    order: "created_at.desc",
  });
  return rows.map(mapAssignment);
}

export async function createProgrammeAssignmentClient(input: ProgrammeAssignmentInput) {
  const currentPerson = await getCurrentPerson();
  if (!currentPerson) throw new Error("Connect your training profile first.");
  if (!input.exercises.length) throw new Error("Map the programme exercises first.");

  const existing = await supabasePublicSelect<Pick<ProgrammeAssignmentRecord, "id">>(
    "program_assignments",
    {
      select: "id",
      program_id: `eq.${input.programId}`,
      person_id: `eq.${input.personId}`,
      status: "in.(active,paused)",
      limit: 1,
    },
  );
  if (existing[0]) throw new Error("This person already has an active or paused assignment.");

  const inserted = await supabasePublicInsert<ProgrammeAssignmentRecord>("program_assignments", {
    program_id: input.programId,
    person_id: input.personId,
    assigned_by_person_id: currentPerson.id,
    status: input.status,
    current_workout_index: 0,
    started_on: input.startedOn || null,
    notes: input.notes.trim() || null,
  });
  const assignment = inserted[0];
  if (!assignment) throw new Error("The programme assignment was not created.");

  try {
    await supabasePublicInsert<ProgrammeAssignmentExerciseRecord>(
      "program_assignment_exercises",
      input.exercises.map((exercise) => ({
        program_assignment_id: assignment.id,
        slot_key: exercise.slotKey,
        exercise_id: exercise.exerciseId,
        exercise_name: exercise.exerciseName,
        training_max: exercise.trainingMax,
      })),
    );
  } catch (error) {
    await supabasePublicDelete<ProgrammeAssignmentRecord>("program_assignments", {
      id: `eq.${assignment.id}`,
      person_id: `eq.${input.personId}`,
    }).catch(() => undefined);
    throw error;
  }

  return assignment.id;
}

export async function setProgrammeAssignmentStatusClient(
  id: string,
  status: "active" | "paused" | "archived",
) {
  const rows = await supabasePublicUpdate<ProgrammeAssignmentRecord>(
    "program_assignments",
    { id: `eq.${id}` },
    { status },
  );
  if (!rows[0]) throw new Error("The programme assignment was not updated.");
  if (status === "paused" || status === "archived") {
    await supabasePublicUpdate(
      "suggested_workouts",
      {
        program_assignment_id: `eq.${id}`,
        status: "in.(pending,accepted)",
      },
      { status: "archived" },
    );
  }
  return mapAssignment(rows[0]);
}

export async function getCurrentProgrammeWorkoutOffersClient(): Promise<ProgrammeWorkoutOffer[]> {
  const currentPerson = await getCurrentPerson();
  if (!currentPerson) throw new Error("Connect your training profile first.");
  const [templates, assignments, linkedWorkouts] = await Promise.all([
    listProgrammeTemplatesClient(),
    listProgrammeAssignmentsClient(),
    supabasePublicSelect<LinkedSuggestedWorkoutRecord>("suggested_workouts", {
      select: "id,program_assignment_id,program_workout_id",
      person_id: `eq.${currentPerson.id}`,
      program_assignment_id: "not.is.null",
      status: "in.(pending,accepted)",
    }),
  ]);
  const linkedKeys = new Set(
    linkedWorkouts.map((workout) =>
      [workout.program_assignment_id, workout.program_workout_id].join(":"),
    ),
  );
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const offers: ProgrammeWorkoutOffer[] = [];

  for (const assignment of assignments) {
    if (assignment.personId !== currentPerson.id || assignment.status !== "active") continue;
    const template = templateById.get(assignment.programId);
    const workout = template?.workouts[assignment.currentWorkoutIndex];
    const method = getProgrammeMethodSetup(template?.methodType ?? null);
    if (!template || !workout || !method || !template.methodType) continue;
    if (linkedKeys.has(`${assignment.id}:${workout.id}`)) continue;

    const mappingBySlot = new Map(
      assignment.exercises.map((exercise) => [exercise.slotKey, exercise]),
    );
    const exerciseIds: string[] = [];
    const movements: WorkoutPlanMovement[] = [];
    let invalid = false;

    for (const entry of workout.entries) {
      const mapping = entry.slotKey ? mappingBySlot.get(entry.slotKey) : null;
      if (!mapping?.exerciseId) {
        if (entry.isOptional) continue;
        invalid = true;
        break;
      }
      const setRows = method.buildSetRows({
        minimumSets: entry.minSets,
        maximumSets: entry.maxSets,
        minimumReps: entry.minReps,
        maximumReps: entry.maxReps,
        setChoice: template.defaultSetChoice,
        intensityPercent: entry.intensityPercent,
        trainingMax: mapping.trainingMax,
        roundingIncrement: entry.roundingIncrement ?? template.roundingIncrement,
      });
      if (!setRows.length) {
        invalid = true;
        break;
      }
      exerciseIds.push(mapping.exerciseId);
      movements.push({
        exercise: mapping.exerciseName,
        workoutType: method.workoutType,
        sourceDate: "",
        reason: [
          entry.intensityPercent != null && mapping.trainingMax != null
            ? `${entry.intensityPercent}% of ${mapping.trainingMax} kg training max.`
            : null,
          entry.isOptional ? "Optional movement." : null,
          entry.notes,
        ]
          .filter(Boolean)
          .join(" "),
        setRows,
      });
    }
    if (invalid || !movements.length) continue;

    const sequenceLabel = [
      workout.weekNumber ? `Week ${workout.weekNumber}` : null,
      workout.sessionNumber ? `Session ${workout.sessionNumber}` : workout.name,
    ]
      .filter(Boolean)
      .join(" · ");
    offers.push({
      assignmentId: assignment.id,
      programWorkoutId: workout.id,
      programmeName: template.name,
      workoutName: workout.name,
      workoutNumber: assignment.currentWorkoutIndex + 1,
      totalWorkouts: template.workouts.length,
      weekNumber: workout.weekNumber,
      sessionNumber: workout.sessionNumber,
      methodType: template.methodType,
      basis: `${sequenceLabel}. Loads are calculated from this assignment's training maxes and rounded to the template increment.`,
      movements,
      exerciseIds,
    });
  }

  return offers;
}

export async function startProgrammeWorkoutClient(
  assignmentId: string,
  locationKind: PlannerLocation,
): Promise<WorkoutPlanDraft> {
  const currentPerson = await getCurrentPerson();
  if (!currentPerson) throw new Error("Connect your training profile first.");
  const offer = (await getCurrentProgrammeWorkoutOffersClient()).find(
    (candidate) => candidate.assignmentId === assignmentId,
  );
  if (!offer) {
    throw new Error("This programme session is no longer available. Refresh Today to continue.");
  }
  const locations = await supabasePublicSelect<{ id: string }>("training_locations", {
    select: "id",
    person_id: `eq.${currentPerson.id}`,
    kind: `eq.${locationKind}`,
    is_active: "eq.true",
    limit: 1,
  });
  const location = locations[0];
  if (!location) throw new Error(`Add or restore a ${locationKind} training location first.`);

  const title = `${offer.programmeName} · ${offer.workoutName}`;
  const inserted = await supabasePublicInsert<{ id: string }>("suggested_workouts", {
    person_id: currentPerson.id,
    program_assignment_id: offer.assignmentId,
    program_workout_id: offer.programWorkoutId,
    training_location_id: location.id,
    suggested_for: new Date().toISOString().slice(0, 10),
    status: "accepted",
    title,
    basis: offer.basis,
  });
  const workout = inserted[0];
  if (!workout) throw new Error("The programme session was not started.");

  try {
    for (const [movementIndex, movement] of offer.movements.entries()) {
      const entries = await supabasePublicInsert<{ id: string }>("suggested_workout_entries", {
        suggested_workout_id: workout.id,
        exercise_id: offer.exerciseIds[movementIndex],
        name: movement.exercise,
        workout_type: movement.workoutType,
        order_index: movementIndex,
        reason: movement.reason,
      });
      const entry = entries[0];
      if (!entry) throw new Error(`${movement.exercise} was not added to the programme session.`);
      await supabasePublicInsert(
        "suggested_workout_sets",
        movement.setRows.map((set, setIndex) => ({
          suggested_workout_entry_id: entry.id,
          set_number: setIndex + 1,
          reps: Number(set.reps),
          weight: Number(set.weight),
          rpe: null,
          completed: true,
        })),
      );
    }
  } catch (error) {
    await supabasePublicDelete("suggested_workouts", { id: `eq.${workout.id}` }).catch(
      () => undefined,
    );
    throw error;
  }

  return {
    version: 1,
    suggestedWorkoutId: workout.id,
    title,
    locationKind,
    basis: offer.basis,
    movements: offer.movements,
    methodBlocks: [],
  };
}
