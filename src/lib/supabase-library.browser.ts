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
  activity_type_id: string | null;
  activity_types: { name: string | null } | null;
};

type PersonExerciseRecord = {
  id: string;
  person_id: string;
  exercise_id: string;
  is_enabled: boolean;
};

export type LibraryClientRow = LibraryRow & {
  id: string;
  enabled: boolean;
  personExerciseId: string | null;
};

export type LibraryFields = Omit<LibraryRow, "row">;
export { claimNoamProfile };

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
    enabled: personExercise?.is_enabled ?? false,
    personExerciseId: personExercise?.id ?? null,
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
    select: "id,person_id,exercise_id,is_enabled",
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

export async function listLibraryClient(personId?: string) {
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
        "id,source_row,focus_area,name,equipment,default_metric,suggested_sets,suggested_reps,notes,is_active,activity_type_id,activity_types(name)",
      is_active: "eq.true",
      order: "source_row.asc",
    }),
    listPersonExercises(selectedPersonId),
  ]);

  const byExercise = new Map(personExercises.map((pe) => [pe.exercise_id, pe]));
  const workoutTypes = activityTypes
    .map((t) => t.name)
    .filter((name, index, all) => name && all.indexOf(name) === index);

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
    },
  );
  return { ok: true };
}

export async function hideExerciseClient(id: string) {
  await supabasePublicUpdate<ExerciseRecord>(
    "exercises",
    { id: `eq.${id}` },
    { is_active: false },
  );
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
    select: "id,person_id,exercise_id,is_enabled",
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
    });
  }
  return { ok: true };
}
