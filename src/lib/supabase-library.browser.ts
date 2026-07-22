import {
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import {
  claimNoamProfile,
  getCurrentPerson,
  listManagedPeopleClient,
  type PersonRecord,
} from "./supabase-people.browser";
import type { LibraryRow } from "./training-types";
import {
  DEFAULT_CIRCUIT_METADATA,
  type CircuitDifficulty,
  type CircuitDoseMode,
  type CircuitImpact,
  type CircuitMovementPattern,
  type CircuitSuitability,
} from "./circuit-metadata";

type ActivityTypeRecord = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

type ExerciseRecord = {
  id: string;
  source_row: number | null;
  focus_area: string | null;
  name: string;
  equipment: string | null;
  default_metric: string | null;
  suggested_sets: string | null;
  suggested_reps: string | null;
  notes: string | null;
  is_active: boolean;
  circuit_suitability: CircuitSuitability;
  circuit_pattern: CircuitMovementPattern;
  circuit_difficulty: CircuitDifficulty;
  circuit_impact: CircuitImpact;
  circuit_dose_mode: CircuitDoseMode;
  circuit_dose_min: number | string | null;
  circuit_dose_max: number | string | null;
  circuit_dose_per_side: boolean;
  activity_type_id: string | null;
  activity_types: { name: string | null } | null;
};

type PersonExerciseRecord = {
  id: string;
  person_id: string;
  exercise_id: string;
  is_enabled: boolean;
  location_scope: ExerciseLocationScope;
};

export type ExerciseLocationScope = "home" | "gym" | "both";

export type LibraryClientRow = LibraryRow & {
  id: string;
  enabled: boolean;
  active: boolean;
  personExerciseId: string | null;
  locationScope: ExerciseLocationScope;
};

export type LibraryFields = Omit<LibraryRow, "row">;
export { claimNoamProfile };

function nullableNumber(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function mapExercise(row: ExerciseRecord, personExercise?: PersonExerciseRecord): LibraryClientRow {
  return {
    id: row.id,
    row: row.source_row ?? 0,
    workoutType: row.activity_types?.name ?? "",
    focusArea: row.focus_area ?? "",
    name: row.name,
    equipment: row.equipment ?? "",
    metric: row.default_metric ?? "",
    suggestedSets: row.suggested_sets ?? "",
    suggestedReps: row.suggested_reps ?? "",
    notes: row.notes ?? "",
    circuitSuitability: row.circuit_suitability ?? DEFAULT_CIRCUIT_METADATA.circuitSuitability,
    circuitPattern: row.circuit_pattern ?? DEFAULT_CIRCUIT_METADATA.circuitPattern,
    circuitDifficulty: row.circuit_difficulty ?? DEFAULT_CIRCUIT_METADATA.circuitDifficulty,
    circuitImpact: row.circuit_impact ?? DEFAULT_CIRCUIT_METADATA.circuitImpact,
    circuitDoseMode: row.circuit_dose_mode ?? DEFAULT_CIRCUIT_METADATA.circuitDoseMode,
    circuitDoseMin:
      row.circuit_dose_min == null
        ? DEFAULT_CIRCUIT_METADATA.circuitDoseMin
        : String(row.circuit_dose_min),
    circuitDoseMax:
      row.circuit_dose_max == null
        ? DEFAULT_CIRCUIT_METADATA.circuitDoseMax
        : String(row.circuit_dose_max),
    circuitDosePerSide: row.circuit_dose_per_side ?? DEFAULT_CIRCUIT_METADATA.circuitDosePerSide,
    active: row.is_active,
    enabled: personExercise?.is_enabled ?? false,
    personExerciseId: personExercise?.id ?? null,
    locationScope: personExercise?.location_scope ?? "both",
  };
}

async function listActivityTypes() {
  return supabasePublicSelect<ActivityTypeRecord>("activity_types", {
    select: "id,name,slug,sort_order",
    order: "sort_order.asc,name.asc",
  });
}

async function getOrCreateActivityType(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const existing = await supabasePublicSelect<ActivityTypeRecord>("activity_types", {
    select: "id,name,slug,sort_order",
    name: `eq.${trimmed}`,
    limit: 1,
  });
  if (existing[0]) return existing[0];

  const slug = slugify(trimmed) || "other";
  const bySlug = await supabasePublicSelect<ActivityTypeRecord>("activity_types", {
    select: "id,name,slug,sort_order",
    slug: `eq.${slug}`,
    limit: 1,
  });
  if (bySlug[0]) return bySlug[0];

  const inserted = await supabasePublicInsert<ActivityTypeRecord>("activity_types", {
    name: trimmed,
    slug,
    sort_order: 500,
  });
  return inserted[0] ?? null;
}

async function findNextExerciseSourceRow() {
  const rows = await supabasePublicSelect<Pick<ExerciseRecord, "source_row">>("exercises", {
    select: "source_row",
    source_sheet: "eq.Exercise Library",
    order: "source_row.desc",
    limit: 1,
  });
  return Math.max(5, (rows[0]?.source_row ?? 4) + 1);
}

async function listPersonExercises(personId: string) {
  return supabasePublicSelect<PersonExerciseRecord>("person_exercises", {
    select: "id,person_id,exercise_id,is_enabled,location_scope",
    person_id: `eq.${personId}`,
  });
}

async function getTargetPerson(personId?: string) {
  const current = await getCurrentPerson();
  if (!current) return null;
  if (!personId || personId === current.id) return current;
  const people = await listManagedPeopleClient();
  return people.find((p) => p.id === personId) ?? current;
}

export async function listLibraryClient(personId?: string, includeInactive = false) {
  const current = await getCurrentPerson();
  if (!current) {
    return {
      needsProfileClaim: true as const,
      people: [] as PersonRecord[],
      selectedPersonId: null,
      workoutTypes: [] as string[],
      items: [] as LibraryClientRow[],
    };
  }

  const people = await listManagedPeopleClient();
  const selectedPersonId =
    personId && people.some((p) => p.id === personId) ? personId : current.id;

  const [activityTypes, exercises, personExercises] = await Promise.all([
    listActivityTypes(),
    supabasePublicSelect<ExerciseRecord>("exercises", {
      select:
        "id,source_row,focus_area,name,equipment,default_metric,suggested_sets,suggested_reps,notes,is_active,circuit_suitability,circuit_pattern,circuit_difficulty,circuit_impact,circuit_dose_mode,circuit_dose_min,circuit_dose_max,circuit_dose_per_side,activity_type_id,activity_types(name)",
      ...(includeInactive ? {} : { is_active: "eq.true" }),
      order: "source_row.asc",
    }),
    listPersonExercises(selectedPersonId),
  ]);

  const byExercise = new Map(personExercises.map((pe) => [pe.exercise_id, pe]));
  const activeExerciseTypes = new Set(
    exercises
      .filter((row) => row.is_active)
      .map((row) => row.activity_types?.name)
      .filter(Boolean),
  );
  const workoutTypes = activityTypes
    .map((t) => t.name)
    .filter((name, index, all) => {
      if (!name || all.indexOf(name) !== index) return false;
      if (name === "Bouldering" || name === "Sport") return false;
      return activeExerciseTypes.has(name);
    });

  return {
    needsProfileClaim: false as const,
    people,
    selectedPersonId,
    workoutTypes,
    items: exercises.map((row) => mapExercise(row, byExercise.get(row.id))),
  };
}

export async function addExerciseClient(fields: LibraryFields, personId?: string) {
  const [activityType, sourceRow, targetPerson] = await Promise.all([
    getOrCreateActivityType(fields.workoutType),
    findNextExerciseSourceRow(),
    getTargetPerson(personId),
  ]);
  if (!targetPerson) throw new Error("Claim your profile first.");

  const inserted = await supabasePublicInsert<ExerciseRecord>("exercises", {
    activity_type_id: activityType?.id ?? null,
    focus_area: fields.focusArea,
    name: fields.name,
    equipment: fields.equipment,
    default_metric: fields.metric,
    suggested_sets: fields.suggestedSets,
    suggested_reps: fields.suggestedReps,
    notes: fields.notes,
    circuit_suitability: fields.circuitSuitability,
    circuit_pattern: fields.circuitPattern,
    circuit_difficulty: fields.circuitDifficulty,
    circuit_impact: fields.circuitImpact,
    circuit_dose_mode: fields.circuitDoseMode,
    circuit_dose_min: nullableNumber(fields.circuitDoseMin),
    circuit_dose_max: nullableNumber(fields.circuitDoseMax),
    circuit_dose_per_side: fields.circuitDosePerSide,
    source_sheet: "Exercise Library",
    source_row: sourceRow,
    is_active: true,
  });
  const exercise = inserted[0];
  if (exercise) {
    await supabasePublicInsert<PersonExerciseRecord>("person_exercises", {
      person_id: targetPerson.id,
      exercise_id: exercise.id,
      is_enabled: true,
      location_scope: "both",
    });
  }
  return { ok: true, row: exercise?.source_row ?? sourceRow };
}

export async function updateExerciseClient(id: string, fields: LibraryFields) {
  const activityType = await getOrCreateActivityType(fields.workoutType);
  await supabasePublicUpdate<ExerciseRecord>(
    "exercises",
    { id: `eq.${id}` },
    {
      activity_type_id: activityType?.id ?? null,
      focus_area: fields.focusArea,
      name: fields.name,
      equipment: fields.equipment,
      default_metric: fields.metric,
      suggested_sets: fields.suggestedSets,
      suggested_reps: fields.suggestedReps,
      notes: fields.notes,
      circuit_suitability: fields.circuitSuitability,
      circuit_pattern: fields.circuitPattern,
      circuit_difficulty: fields.circuitDifficulty,
      circuit_impact: fields.circuitImpact,
      circuit_dose_mode: fields.circuitDoseMode,
      circuit_dose_min: nullableNumber(fields.circuitDoseMin),
      circuit_dose_max: nullableNumber(fields.circuitDoseMax),
      circuit_dose_per_side: fields.circuitDosePerSide,
    },
  );
  return { ok: true };
}

export async function hideExerciseClient(id: string) {
  await supabasePublicUpdate<ExerciseRecord>("exercises", { id: `eq.${id}` }, { is_active: false });
  return { ok: true };
}

export async function setExerciseEnabledClient(
  exerciseId: string,
  enabled: boolean,
  personId?: string,
) {
  const targetPerson = await getTargetPerson(personId);
  if (!targetPerson) throw new Error("Claim your profile first.");
  const existing = await supabasePublicSelect<PersonExerciseRecord>("person_exercises", {
    select: "id,person_id,exercise_id,is_enabled,location_scope",
    person_id: `eq.${targetPerson.id}`,
    exercise_id: `eq.${exerciseId}`,
    limit: 1,
  });
  const row = existing[0];
  if (row) {
    await supabasePublicUpdate<PersonExerciseRecord>(
      "person_exercises",
      { id: `eq.${row.id}` },
      { is_enabled: enabled },
    );
  } else {
    await supabasePublicInsert<PersonExerciseRecord>("person_exercises", {
      person_id: targetPerson.id,
      exercise_id: exerciseId,
      is_enabled: enabled,
      location_scope: "both",
    });
  }
  return { ok: true };
}

export async function setExerciseLocationScopeClient(
  exerciseId: string,
  locationScope: ExerciseLocationScope,
  personId?: string,
) {
  const targetPerson = await getTargetPerson(personId);
  if (!targetPerson) throw new Error("Claim your profile first.");
  const existing = await supabasePublicSelect<PersonExerciseRecord>("person_exercises", {
    select: "id,person_id,exercise_id,is_enabled,location_scope",
    person_id: `eq.${targetPerson.id}`,
    exercise_id: `eq.${exerciseId}`,
    limit: 1,
  });
  const row = existing[0];
  if (row) {
    await supabasePublicUpdate<PersonExerciseRecord>(
      "person_exercises",
      { id: `eq.${row.id}` },
      { location_scope: locationScope },
    );
  } else {
    await supabasePublicInsert<PersonExerciseRecord>("person_exercises", {
      person_id: targetPerson.id,
      exercise_id: exerciseId,
      is_enabled: false,
      location_scope: locationScope,
    });
  }
  return { ok: true };
}
