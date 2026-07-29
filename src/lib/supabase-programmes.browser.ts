import {
  supabasePublicDelete,
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import { getProgrammeMethodSetup } from "./programme-methods";
import { getCurrentPerson } from "./supabase-people.browser";
import { listLibraryClient } from "./supabase-library.browser";
import { getTrackingModeValue } from "./movement-metrics";
import { todayISO } from "./date";
import {
  adjustmentForDecision,
  decideAdaptiveProgression,
  effectiveIntensityPercent,
  nextCycleTrainingMax,
  programmeWorkoutIsDue,
  suggestedRestForIntensity,
  type AdaptiveDecision,
  type TechniqueRating,
} from "./adaptive-strength";
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
  intensityMinPercent: number | null;
  intensityMaxPercent: number | null;
  percentBase: string | null;
  roundingIncrement: number | null;
  isOptional: boolean;
  weight: string | null;
  duration: string | null;
  rpe: string | null;
  rpeCap: number | null;
  selectionRole: ProgrammeSelectionRole | null;
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
  enabled: boolean;
  loadAdjustmentPercent: number;
  lastDecision: AdaptiveDecision | null;
};

export type ProgrammeSelectionRole = "power" | "accessory" | "pull";

export type ProgrammeExercisePoolItem = {
  id: string;
  role: ProgrammeSelectionRole;
  exerciseId: string;
  exerciseName: string;
  enabled: boolean;
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
  cycleNumber: number;
  previousAssignmentId: string | null;
  exercises: ProgrammeAssignmentExercise[];
  pools: ProgrammeExercisePoolItem[];
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
    enabled?: boolean;
  }>;
  pools?: Array<{
    role: ProgrammeSelectionRole;
    exerciseId: string;
    exerciseName: string;
  }>;
};

export type ProgrammeSelectionOffer = {
  role: ProgrammeSelectionRole;
  label: string;
  required: boolean;
  options: ProgrammeExercisePoolItem[];
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
  selections: ProgrammeSelectionOffer[];
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
  intensity_min_percent: number | string | null;
  intensity_max_percent: number | string | null;
  percent_base: string | null;
  rounding_increment: number | string | null;
  is_optional: boolean | null;
  weight: string | null;
  duration: string | null;
  rpe: string | null;
  rpe_cap: number | string | null;
  selection_role: ProgrammeSelectionRole | null;
  rest: string | null;
  notes: string | null;
};

type ProgrammeAssignmentExerciseRecord = {
  id: string;
  slot_key: string;
  exercise_id: string | null;
  exercise_name: string;
  training_max: number | string | null;
  is_enabled: boolean;
  load_adjustment_percent: number | string;
  last_decision: AdaptiveDecision | null;
};

type ProgrammeExercisePoolRecord = {
  id: string;
  program_assignment_id: string;
  role: ProgrammeSelectionRole;
  exercise_id: string;
  exercise_name: string;
  is_enabled: boolean;
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
  cycle_number: number;
  previous_assignment_id: string | null;
  program_assignment_exercises?: ProgrammeAssignmentExerciseRecord[] | null;
  program_assignment_exercise_pools?: ProgrammeExercisePoolRecord[] | null;
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
        "id,program_workout_id,name,slot_key,order_index,sets,reps,min_sets,max_sets,min_reps,max_reps,intensity_percent,intensity_min_percent,intensity_max_percent,percent_base,rounding_increment,is_optional,weight,duration,rpe,rpe_cap,selection_role,rest,notes",
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
      intensityMinPercent: numberOrNull(entry.intensity_min_percent),
      intensityMaxPercent: numberOrNull(entry.intensity_max_percent),
      percentBase: entry.percent_base,
      roundingIncrement: numberOrNull(entry.rounding_increment),
      isOptional: entry.is_optional ?? false,
      weight: entry.weight,
      duration: entry.duration,
      rpe: entry.rpe,
      rpeCap: numberOrNull(entry.rpe_cap),
      selectionRole: entry.selection_role,
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
    cycleNumber: row.cycle_number,
    previousAssignmentId: row.previous_assignment_id,
    exercises: (row.program_assignment_exercises ?? [])
      .map((exercise) => ({
        id: exercise.id,
        slotKey: exercise.slot_key,
        exerciseId: exercise.exercise_id,
        exerciseName: exercise.exercise_name,
        trainingMax: numberOrNull(exercise.training_max),
        enabled: exercise.is_enabled,
        loadAdjustmentPercent: numberOrNull(exercise.load_adjustment_percent) ?? 0,
        lastDecision: exercise.last_decision,
      }))
      .sort((left, right) => left.slotKey.localeCompare(right.slotKey)),
    pools: (row.program_assignment_exercise_pools ?? [])
      .map((pool) => ({
        id: pool.id,
        role: pool.role,
        exerciseId: pool.exercise_id,
        exerciseName: pool.exercise_name,
        enabled: pool.is_enabled,
      }))
      .sort((left, right) => left.exerciseName.localeCompare(right.exerciseName)),
  };
}

export async function listProgrammeAssignmentsClient(): Promise<ProgrammeAssignment[]> {
  const rows = await supabasePublicSelect<ProgrammeAssignmentRecord>("program_assignments", {
    select:
      "id,program_id,person_id,assigned_by_person_id,status,current_workout_index,started_on,completed_on,notes,created_at,cycle_number,previous_assignment_id,program_assignment_exercises(id,slot_key,exercise_id,exercise_name,training_max,is_enabled,load_adjustment_percent,last_decision),program_assignment_exercise_pools(id,role,exercise_id,exercise_name,is_enabled)",
    status: "in.(active,paused,complete)",
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
        is_enabled: exercise.enabled ?? true,
      })),
    );
    if (input.pools?.length) {
      await supabasePublicInsert<ProgrammeExercisePoolRecord>(
        "program_assignment_exercise_pools",
        input.pools.map((pool) => ({
          program_assignment_id: assignment.id,
          role: pool.role,
          exercise_id: pool.exerciseId,
          exercise_name: pool.exerciseName,
          is_enabled: true,
        })),
      );
    }
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
    if (
      !programmeWorkoutIsDue(
        assignment.startedOn,
        workout.weekNumber,
        workout.dayNumber,
        todayISO(),
      )
    ) {
      continue;
    }
    if (linkedKeys.has(`${assignment.id}:${workout.id}`)) continue;

    const mappingBySlot = new Map(
      assignment.exercises.map((exercise) => [exercise.slotKey, exercise]),
    );
    const exerciseIds: string[] = [];
    const movements: WorkoutPlanMovement[] = [];
    const selections: ProgrammeSelectionOffer[] = [];
    let invalid = false;

    for (const entry of workout.entries) {
      if (entry.selectionRole) {
        selections.push({
          role: entry.selectionRole,
          label: entry.name,
          required: !entry.isOptional,
          options: assignment.pools.filter(
            (pool) => pool.enabled && pool.role === entry.selectionRole,
          ),
        });
        continue;
      }
      const mapping = entry.slotKey ? mappingBySlot.get(entry.slotKey) : null;
      if (!mapping?.exerciseId || !mapping.enabled) {
        if (entry.isOptional) continue;
        invalid = true;
        break;
      }
      const plannedIntensity = effectiveIntensityPercent({
        minimum: entry.intensityMinPercent ?? entry.intensityPercent,
        maximum: entry.intensityMaxPercent ?? entry.intensityPercent,
        adjustment: mapping.loadAdjustmentPercent,
      });
      const setRows = method.buildSetRows({
        minimumSets: entry.minSets,
        maximumSets: entry.maxSets,
        minimumReps: entry.minReps,
        maximumReps: entry.maxReps,
        setChoice: template.defaultSetChoice,
        intensityPercent: plannedIntensity,
        trainingMax: mapping.trainingMax,
        roundingIncrement: entry.roundingIncrement ?? template.roundingIncrement,
      });
      if (!setRows.length) {
        invalid = true;
        break;
      }
      exerciseIds.push(mapping.exerciseId);
      const restTime = suggestedRestForIntensity(plannedIntensity);
      movements.push({
        exercise: mapping.exerciseName,
        workoutType: method.workoutType,
        trackingMode: "weight_reps",
        targets: {
          durationMinutes: "",
          distance: "",
          distanceUnit: "",
          rounds: "",
          height: "",
          detail: "",
        },
        sourceDate: "",
        reason: [
          entry.intensityPercent != null && mapping.trainingMax != null
            ? `${plannedIntensity}% of ${mapping.trainingMax} kg training max.`
            : null,
          entry.intensityMinPercent != null && entry.intensityMaxPercent != null
            ? `Planned range ${entry.intensityMinPercent}-${entry.intensityMaxPercent}%; start at the safe end.`
            : null,
          entry.rpeCap != null ? `RPE cap ${entry.rpeCap}.` : null,
          restTime ? `Suggested rest ${restTime} between sets.` : null,
          mapping.lastDecision ? `Last review: ${mapping.lastDecision}.` : null,
          entry.isOptional ? "Optional movement." : null,
          entry.notes,
        ]
          .filter(Boolean)
          .join(" "),
        restTime,
        setRows: setRows.map((set) => ({ ...set, durationSeconds: "" })),
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
      selections,
    });
  }

  return offers;
}

export async function startProgrammeWorkoutClient(
  assignmentId: string,
  trainingLocationId: string,
  selectedExerciseIds: Partial<Record<ProgrammeSelectionRole, string>> = {},
): Promise<WorkoutPlanDraft> {
  const currentPerson = await getCurrentPerson();
  if (!currentPerson) throw new Error("Connect your training profile first.");
  const offer = (await getCurrentProgrammeWorkoutOffersClient()).find(
    (candidate) => candidate.assignmentId === assignmentId,
  );
  if (!offer) {
    throw new Error("This programme session is no longer available. Refresh Today to continue.");
  }
  const library = await listLibraryClient(currentPerson.id);
  const libraryById = new Map(library.items.map((item) => [item.id, item]));
  const location = library.locations.find((candidate) => candidate.id === trainingLocationId);
  if (!location || (location.kind !== "home" && location.kind !== "gym")) {
    throw new Error("Choose an active Home or Gym training location first.");
  }
  const locationKind: PlannerLocation = location.kind;
  for (const exerciseId of offer.exerciseIds) {
    const mappedExercise = libraryById.get(exerciseId);
    if (!mappedExercise?.availableLocationIds.includes(location.id)) {
      throw new Error(
        `${mappedExercise?.name ?? "A mapped movement"} is not available at ${location.name}.`,
      );
    }
  }
  const selectedMovements: Array<{
    role: ProgrammeSelectionRole;
    exerciseId: string;
    movement: WorkoutPlanMovement;
  }> = [];
  for (const selection of offer.selections) {
    const selectedId = selectedExerciseIds[selection.role];
    if (!selectedId) {
      if (selection.required) throw new Error(`Choose ${selection.label.toLowerCase()} first.`);
      continue;
    }
    if (!selection.options.some((option) => option.exerciseId === selectedId)) {
      throw new Error(`${selection.label} is not in this assignment's Library pool.`);
    }
    const libraryItem = libraryById.get(selectedId);
    if (!libraryItem?.active || !libraryItem.enabled) {
      throw new Error(`${selection.label} is no longer enabled in Library.`);
    }
    if (!libraryItem.availableLocationIds.includes(location.id)) {
      throw new Error(`${libraryItem.name} is not available at ${location.name}.`);
    }
    const firstNumber = (value: string, fallback: number) => {
      const parsed = Number(value.match(/\d+(?:\.\d+)?/)?.[0]);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };
    const sets = Math.min(5, firstNumber(libraryItem.suggestedSets, 3));
    const reps = firstNumber(
      libraryItem.suggestedReps,
      selection.role === "power" ? 3 : selection.role === "pull" ? 6 : 8,
    );
    selectedMovements.push({
      role: selection.role,
      exerciseId: selectedId,
      movement: {
        exercise: libraryItem.name,
        workoutType: libraryItem.workoutType || (selection.role === "power" ? "Power" : "Strength"),
        trackingMode: getTrackingModeValue({
          workoutType:
            libraryItem.workoutType || (selection.role === "power" ? "Power" : "Strength"),
          movement: libraryItem.name,
          defaultMetric: libraryItem.metric,
        }),
        targets: {
          durationMinutes: "",
          distance: "",
          distanceUnit: "",
          rounds: "",
          height: "",
          detail: "",
        },
        sourceDate: "",
        reason: `${selection.label}. Chosen from this assignment's existing Library pool; optional and autoregulated.`,
        setRows: Array.from({ length: sets }, () => ({
          reps: String(reps),
          weight: "",
          durationSeconds: "",
          rpe: "",
          completed: true,
        })),
      },
    });
  }
  const power = selectedMovements.filter((item) => item.role === "power");
  const afterMain = selectedMovements.filter((item) => item.role !== "power");
  const selectedPlanMovements = [
    ...power.map((item) => item.movement),
    ...offer.movements,
    ...afterMain.map((item) => item.movement),
  ];
  const selectedPlanExerciseIds = [
    ...power.map((item) => item.exerciseId),
    ...offer.exerciseIds,
    ...afterMain.map((item) => item.exerciseId),
  ];
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
    for (const [movementIndex, movement] of selectedPlanMovements.entries()) {
      const entries = await supabasePublicInsert<{ id: string }>("suggested_workout_entries", {
        suggested_workout_id: workout.id,
        exercise_id: selectedPlanExerciseIds[movementIndex],
        name: movement.exercise,
        workout_type: movement.workoutType,
        order_index: movementIndex,
        reason: movement.reason,
        tracking_mode: movement.trackingMode,
        target_metrics: {},
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
          duration_seconds: null,
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
    trainingLocationId: location.id,
    basis: offer.basis,
    movements: selectedPlanMovements,
    methodBlocks: [],
  };
}

type ProgrammeCompletionLink = {
  program_assignment_id: string | null;
  program_workout_id: string | null;
};

type ProgrammeCompletedEntry = {
  exercise_id: string | null;
  completed: boolean;
  entry_sets: Array<{ rpe: number | string | null }> | null;
  entry_metrics: Array<{
    metric_key: string;
    metric_value: number | string | null;
    metric_text: string | null;
  }> | null;
};

export async function applyProgrammeReviewClient(suggestedWorkoutId: string, sessionId: string) {
  const links = await supabasePublicSelect<ProgrammeCompletionLink>("suggested_workouts", {
    select: "program_assignment_id,program_workout_id",
    id: `eq.${suggestedWorkoutId}`,
    completed_session_id: `eq.${sessionId}`,
    limit: 1,
  });
  const link = links[0];
  if (!link?.program_assignment_id || !link.program_workout_id) return { reviewed: 0 };

  const [assignments, entries, prescriptions] = await Promise.all([
    listProgrammeAssignmentsClient(),
    supabasePublicSelect<ProgrammeCompletedEntry>("session_entries", {
      select:
        "exercise_id,completed,entry_sets(rpe),entry_metrics(metric_key,metric_value,metric_text)",
      session_id: `eq.${sessionId}`,
    }),
    supabasePublicSelect<ProgrammeEntryRecord>("program_workout_entries", {
      select:
        "id,program_workout_id,name,slot_key,order_index,sets,reps,min_sets,max_sets,min_reps,max_reps,intensity_percent,intensity_min_percent,intensity_max_percent,percent_base,rounding_increment,is_optional,weight,duration,rpe,rpe_cap,selection_role,rest,notes",
      program_workout_id: `eq.${link.program_workout_id}`,
    }),
  ]);
  const assignment = assignments.find((item) => item.id === link.program_assignment_id);
  if (!assignment) return { reviewed: 0 };
  const prescriptionBySlot = new Map(
    prescriptions.filter((item) => item.slot_key).map((item) => [item.slot_key!, item]),
  );
  let reviewed = 0;

  for (const mapping of assignment.exercises) {
    if (!mapping.enabled || !mapping.exerciseId) continue;
    const prescription = prescriptionBySlot.get(mapping.slotKey);
    const completedEntry = entries.find((entry) => entry.exercise_id === mapping.exerciseId);
    if (!prescription || !completedEntry) continue;
    const setRpes = (completedEntry.entry_sets ?? [])
      .map((set) => numberOrNull(set.rpe))
      .filter((value): value is number => value != null);
    const metrics = completedEntry.entry_metrics ?? [];
    const pain = numberOrNull(
      metrics.find((metric) => metric.metric_key === "pain")?.metric_value ?? null,
    );
    const techniqueText = metrics.find((metric) => metric.metric_key === "technique")?.metric_text;
    const technique =
      techniqueText === "good" || techniqueText === "acceptable" || techniqueText === "poor"
        ? (techniqueText as TechniqueRating)
        : null;
    const decision = decideAdaptiveProgression({
      completed: completedEntry.completed,
      rpe: setRpes.length ? Math.max(...setRpes) : null,
      rpeCap: numberOrNull(prescription.rpe_cap),
      technique,
      pain,
    });
    const adjustment = adjustmentForDecision(decision);
    const reviewPayload = {
      program_assignment_id: assignment.id,
      program_workout_id: link.program_workout_id,
      program_assignment_exercise_id: mapping.id,
      session_id: sessionId,
      rpe: setRpes.length ? Math.max(...setRpes) : null,
      technique,
      pain,
      decision,
      applied_adjustment_percent: adjustment,
    };
    const existing = await supabasePublicSelect<{ id: string }>("program_workout_reviews", {
      select: "id",
      program_assignment_id: `eq.${assignment.id}`,
      program_workout_id: `eq.${link.program_workout_id}`,
      program_assignment_exercise_id: `eq.${mapping.id}`,
      limit: 1,
    });
    if (existing[0]) {
      await supabasePublicUpdate(
        "program_workout_reviews",
        { id: `eq.${existing[0].id}` },
        reviewPayload,
      );
    } else {
      await supabasePublicInsert("program_workout_reviews", reviewPayload);
    }
    await supabasePublicUpdate(
      "program_assignment_exercises",
      { id: `eq.${mapping.id}` },
      { load_adjustment_percent: adjustment, last_decision: decision },
    );
    reviewed += 1;
  }
  return { reviewed };
}

export async function setProgrammeExerciseEnabledClient(id: string, enabled: boolean) {
  const rows = await supabasePublicUpdate<ProgrammeAssignmentExerciseRecord>(
    "program_assignment_exercises",
    { id: `eq.${id}` },
    { is_enabled: enabled },
  );
  if (!rows[0]) throw new Error("The programme stream was not updated.");
  return rows[0];
}

export async function createNextProgrammeCycleClient(assignmentId: string) {
  const currentPerson = await getCurrentPerson();
  if (!currentPerson) throw new Error("Connect your training profile first.");
  const source = (await listProgrammeAssignmentsClient()).find(
    (assignment) => assignment.id === assignmentId,
  );
  if (!source || source.status !== "complete") {
    throw new Error("Complete the current 12-week cycle before creating the next one.");
  }
  const active = (await listProgrammeAssignmentsClient()).some(
    (assignment) =>
      assignment.personId === source.personId &&
      assignment.programId === source.programId &&
      (assignment.status === "active" || assignment.status === "paused"),
  );
  if (active) throw new Error("This person already has an active or paused cycle.");

  const inserted = await supabasePublicInsert<ProgrammeAssignmentRecord>("program_assignments", {
    program_id: source.programId,
    person_id: source.personId,
    assigned_by_person_id: currentPerson.id,
    status: "active",
    current_workout_index: 0,
    started_on: new Date().toISOString().slice(0, 10),
    notes: `Generated from cycle ${source.cycleNumber}. Training max increases remain editable.`,
    cycle_number: source.cycleNumber + 1,
    previous_assignment_id: source.id,
  });
  const next = inserted[0];
  if (!next) throw new Error("The next programme cycle was not created.");
  try {
    await supabasePublicInsert(
      "program_assignment_exercises",
      source.exercises.map((exercise) => ({
        program_assignment_id: next.id,
        slot_key: exercise.slotKey,
        exercise_id: exercise.exerciseId,
        exercise_name: exercise.exerciseName,
        training_max: nextCycleTrainingMax(exercise.slotKey, exercise.trainingMax),
        is_enabled: exercise.enabled,
        load_adjustment_percent: 0,
        last_decision: null,
      })),
    );
    if (source.pools.length) {
      await supabasePublicInsert(
        "program_assignment_exercise_pools",
        source.pools.map((pool) => ({
          program_assignment_id: next.id,
          role: pool.role,
          exercise_id: pool.exerciseId,
          exercise_name: pool.exerciseName,
          is_enabled: pool.enabled,
        })),
      );
    }
  } catch (error) {
    await supabasePublicDelete("program_assignments", { id: `eq.${next.id}` }).catch(
      () => undefined,
    );
    throw error;
  }
  return next.id;
}
