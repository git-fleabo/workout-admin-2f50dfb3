import {
  supabasePublicDelete,
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
  position_measurement_guide: string | null;
  position_measurement_label: string | null;
  position_measurement_direction: string | null;
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
  is_quick_log: boolean;
  quick_log_order: number | null;
};

type EquipmentItemRecord = {
  id: string;
  person_id: string;
  name: string;
  category: string;
  circuit_group: string;
  sort_order: number;
  is_active: boolean;
};

type ExerciseEquipmentItemRecord = {
  exercise_id: string;
  equipment_item_id: string;
};

type TrainingLocationRecord = {
  id: string;
  person_id: string;
  name: string;
  kind: "home" | "gym" | "other";
  is_active: boolean;
};

type TrainingLocationEquipmentRecord = {
  location_id: string;
  equipment_item_id: string;
};

export type ExerciseLocationScope = "home" | "gym" | "both";

export type LibraryEquipmentItem = {
  id: string;
  name: string;
  category: string;
  circuitGroup: string;
  isActive: boolean;
};

export type LibraryClientRow = LibraryRow & {
  id: string;
  enabled: boolean;
  active: boolean;
  personExerciseId: string | null;
  locationScope: ExerciseLocationScope;
  quickLog: boolean;
  equipmentItemIds: string[];
  equipmentCircuitGroups: string[];
  availableLocationIds: string[];
  availableLocationKinds: Array<"home" | "gym" | "other">;
  availableLocationNames: string[];
};

export type LibraryFields = Omit<LibraryRow, "row"> & {
  equipmentItemIds: string[];
};
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

function scopeAllowsKind(scope: ExerciseLocationScope, kind: TrainingLocationRecord["kind"]) {
  return kind === "other" || scope === "both" || scope === kind;
}

function mapExercise(
  row: ExerciseRecord,
  personExercise: PersonExerciseRecord | undefined,
  equipmentItems: EquipmentItemRecord[],
  locations: TrainingLocationRecord[],
  locationEquipment: Map<string, Set<string>>,
): LibraryClientRow {
  const locationScope = personExercise?.location_scope ?? "both";
  const requiredIds = equipmentItems.map((item) => item.id);
  const availableLocations = locations.filter((location) => {
    if (!scopeAllowsKind(locationScope, location.kind)) return false;
    const availableIds = locationEquipment.get(location.id) ?? new Set<string>();
    return requiredIds.every((id) => availableIds.has(id));
  });
  return {
    id: row.id,
    row: row.source_row ?? 0,
    workoutType: row.activity_types?.name ?? "",
    focusArea: row.focus_area ?? "",
    name: row.name,
    equipment: equipmentItems.map((item) => item.name).join(" / "),
    metric: row.default_metric ?? "",
    suggestedSets: row.suggested_sets ?? "",
    suggestedReps: row.suggested_reps ?? "",
    positionMeasurementGuide: row.position_measurement_guide ?? "",
    positionMeasurementLabel: row.position_measurement_label ?? "",
    positionMeasurementDirection: row.position_measurement_direction ?? "",
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
    quickLog: personExercise?.is_quick_log ?? false,
    personExerciseId: personExercise?.id ?? null,
    locationScope,
    equipmentItemIds: requiredIds,
    equipmentCircuitGroups: Array.from(new Set(equipmentItems.map((item) => item.circuit_group))),
    availableLocationIds: availableLocations.map((location) => location.id),
    availableLocationKinds: Array.from(
      new Set(availableLocations.map((location) => location.kind)),
    ),
    availableLocationNames: availableLocations.map((location) => location.name),
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

async function listPersonExercises(personId: string) {
  return supabasePublicSelect<PersonExerciseRecord>("person_exercises", {
    select: "id,person_id,exercise_id,is_enabled,location_scope,is_quick_log,quick_log_order",
    person_id: `eq.${personId}`,
  });
}

async function listEquipmentItems(personId: string) {
  return supabasePublicSelect<EquipmentItemRecord>("equipment_items", {
    select: "id,person_id,name,category,circuit_group,sort_order,is_active",
    person_id: `eq.${personId}`,
    order: "is_active.desc,sort_order.asc,name.asc",
  });
}

async function listExerciseEquipmentItems(equipmentIds: string[]) {
  if (!equipmentIds.length) return [] as ExerciseEquipmentItemRecord[];
  return supabasePublicSelect<ExerciseEquipmentItemRecord>("exercise_equipment_items", {
    select: "exercise_id,equipment_item_id",
    equipment_item_id: `in.(${equipmentIds.join(",")})`,
  });
}

async function listTrainingLocations(personId: string) {
  return supabasePublicSelect<TrainingLocationRecord>("training_locations", {
    select: "id,person_id,name,kind,is_active",
    person_id: `eq.${personId}`,
    is_active: "eq.true",
    order: "kind.asc,name.asc",
  });
}

async function listTrainingLocationEquipment(locationIds: string[]) {
  if (!locationIds.length) return [] as TrainingLocationEquipmentRecord[];
  return supabasePublicSelect<TrainingLocationEquipmentRecord>("training_location_equipment", {
    select: "location_id,equipment_item_id",
    location_id: `in.(${locationIds.join(",")})`,
  });
}

async function getTargetPerson(personId?: string) {
  const current = await getCurrentPerson();
  if (!current) return null;
  if (!personId || personId === current.id) return current;
  const people = await listManagedPeopleClient();
  return people.find((p) => p.id === personId) ?? current;
}

async function equipmentSelectionForPerson(personId: string, equipmentItemIds: string[]) {
  const selectedIds = Array.from(new Set(equipmentItemIds));
  if (!selectedIds.length) return [] as EquipmentItemRecord[];
  const rows = await supabasePublicSelect<EquipmentItemRecord>("equipment_items", {
    select: "id,person_id,name,category,circuit_group,sort_order,is_active",
    person_id: `eq.${personId}`,
    id: `in.(${selectedIds.join(",")})`,
  });
  if (rows.length !== selectedIds.length || rows.some((row) => !row.is_active)) {
    throw new Error("One or more selected equipment items are no longer available.");
  }
  return selectedIds
    .map((id) => rows.find((row) => row.id === id))
    .filter((row): row is EquipmentItemRecord => Boolean(row));
}

async function syncExerciseEquipmentItems(
  exerciseId: string,
  personId: string,
  personEquipmentItems: EquipmentItemRecord[],
) {
  const personEquipmentIds = personEquipmentItems.map((item) => item.id);
  const allPersonEquipment = await listEquipmentItems(personId);
  const allPersonEquipmentIds = allPersonEquipment.map((item) => item.id);
  if (allPersonEquipmentIds.length) {
    await supabasePublicDelete<ExerciseEquipmentItemRecord>("exercise_equipment_items", {
      exercise_id: `eq.${exerciseId}`,
      equipment_item_id: `in.(${allPersonEquipmentIds.join(",")})`,
    });
  }
  if (personEquipmentIds.length) {
    await supabasePublicInsert<ExerciseEquipmentItemRecord>(
      "exercise_equipment_items",
      personEquipmentIds.map((equipmentItemId) => ({
        exercise_id: exerciseId,
        equipment_item_id: equipmentItemId,
      })),
    );
  }
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
      equipmentItems: [] as LibraryEquipmentItem[],
      locations: [] as Array<Pick<TrainingLocationRecord, "id" | "name" | "kind">>,
    };
  }

  const people = await listManagedPeopleClient();
  const selectedPersonId =
    personId && people.some((p) => p.id === personId) ? personId : current.id;

  const [activityTypes, exercises, personExercises, equipmentItems, locations] = await Promise.all([
    listActivityTypes(),
    supabasePublicSelect<ExerciseRecord>("exercises", {
      select:
        "id,source_row,focus_area,name,equipment,default_metric,suggested_sets,suggested_reps,position_measurement_guide,position_measurement_label,position_measurement_direction,notes,is_active,circuit_suitability,circuit_pattern,circuit_difficulty,circuit_impact,circuit_dose_mode,circuit_dose_min,circuit_dose_max,circuit_dose_per_side,activity_type_id,activity_types(name)",
      ...(includeInactive ? {} : { is_active: "eq.true" }),
      order: "name.asc",
    }),
    listPersonExercises(selectedPersonId),
    listEquipmentItems(selectedPersonId),
    listTrainingLocations(selectedPersonId),
  ]);
  const [exerciseEquipmentRows, locationEquipmentRows] = await Promise.all([
    listExerciseEquipmentItems(equipmentItems.map((item) => item.id)),
    listTrainingLocationEquipment(locations.map((location) => location.id)),
  ]);

  const byExercise = new Map(personExercises.map((pe) => [pe.exercise_id, pe]));
  const equipmentById = new Map(equipmentItems.map((item) => [item.id, item]));
  const equipmentByExercise = new Map<string, EquipmentItemRecord[]>();
  for (const link of exerciseEquipmentRows) {
    const item = equipmentById.get(link.equipment_item_id);
    if (!item) continue;
    const items = equipmentByExercise.get(link.exercise_id) ?? [];
    items.push(item);
    equipmentByExercise.set(link.exercise_id, items);
  }
  const equipmentByLocation = new Map<string, Set<string>>();
  for (const link of locationEquipmentRows) {
    const ids = equipmentByLocation.get(link.location_id) ?? new Set<string>();
    ids.add(link.equipment_item_id);
    equipmentByLocation.set(link.location_id, ids);
  }
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
    items: exercises.map((row, index) => ({
      ...mapExercise(
        row,
        byExercise.get(row.id),
        equipmentByExercise.get(row.id) ?? [],
        locations,
        equipmentByLocation,
      ),
      row: index + 1,
    })),
    equipmentItems: equipmentItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      circuitGroup: item.circuit_group,
      isActive: item.is_active,
    })),
    locations: locations.map(({ id, name, kind }) => ({ id, name, kind })),
  };
}

export async function addExerciseClient(fields: LibraryFields, personId?: string) {
  const [activityType, targetPerson] = await Promise.all([
    getOrCreateActivityType(fields.workoutType),
    getTargetPerson(personId),
  ]);
  if (!targetPerson) throw new Error("Claim your profile first.");
  const selectedEquipment = await equipmentSelectionForPerson(
    targetPerson.id,
    fields.equipmentItemIds,
  );

  const inserted = await supabasePublicInsert<ExerciseRecord>("exercises", {
    activity_type_id: activityType?.id ?? null,
    focus_area: fields.focusArea,
    name: fields.name,
    equipment: selectedEquipment.map((item) => item.name).join(" / ") || null,
    default_metric: fields.metric,
    suggested_sets: fields.suggestedSets,
    suggested_reps: fields.suggestedReps,
    position_measurement_guide: fields.positionMeasurementGuide || null,
    position_measurement_label: fields.positionMeasurementGuide
      ? fields.positionMeasurementLabel.trim() || "Position height"
      : null,
    position_measurement_direction: fields.positionMeasurementGuide
      ? fields.positionMeasurementDirection || "neutral"
      : null,
    notes: fields.notes,
    circuit_suitability: fields.circuitSuitability,
    circuit_pattern: fields.circuitPattern,
    circuit_difficulty: fields.circuitDifficulty,
    circuit_impact: fields.circuitImpact,
    circuit_dose_mode: fields.circuitDoseMode,
    circuit_dose_min: nullableNumber(fields.circuitDoseMin),
    circuit_dose_max: nullableNumber(fields.circuitDoseMax),
    circuit_dose_per_side: fields.circuitDosePerSide,
    is_active: true,
  });
  const exercise = inserted[0];
  if (exercise) {
    await Promise.all([
      supabasePublicInsert<PersonExerciseRecord>("person_exercises", {
        person_id: targetPerson.id,
        exercise_id: exercise.id,
        is_enabled: true,
        location_scope: "both",
        is_quick_log: false,
        quick_log_order: null,
      }),
      syncExerciseEquipmentItems(exercise.id, targetPerson.id, selectedEquipment),
    ]);
  }
  return { ok: true, row: "Supabase" };
}

export async function updateExerciseClient(id: string, fields: LibraryFields, personId?: string) {
  const [activityType, targetPerson] = await Promise.all([
    getOrCreateActivityType(fields.workoutType),
    getTargetPerson(personId),
  ]);
  if (!targetPerson) throw new Error("Claim your profile first.");
  const selectedEquipment = await equipmentSelectionForPerson(
    targetPerson.id,
    fields.equipmentItemIds,
  );
  await supabasePublicUpdate<ExerciseRecord>(
    "exercises",
    { id: `eq.${id}` },
    {
      activity_type_id: activityType?.id ?? null,
      focus_area: fields.focusArea,
      name: fields.name,
      equipment: selectedEquipment.map((item) => item.name).join(" / ") || null,
      default_metric: fields.metric,
      suggested_sets: fields.suggestedSets,
      suggested_reps: fields.suggestedReps,
      position_measurement_guide: fields.positionMeasurementGuide || null,
      position_measurement_label: fields.positionMeasurementGuide
        ? fields.positionMeasurementLabel.trim() || "Position height"
        : null,
      position_measurement_direction: fields.positionMeasurementGuide
        ? fields.positionMeasurementDirection || "neutral"
        : null,
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
  await syncExerciseEquipmentItems(id, targetPerson.id, selectedEquipment);
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
    select: "id,person_id,exercise_id,is_enabled,location_scope,is_quick_log,quick_log_order",
    person_id: `eq.${targetPerson.id}`,
    exercise_id: `eq.${exerciseId}`,
    limit: 1,
  });
  const row = existing[0];
  if (row) {
    await supabasePublicUpdate<PersonExerciseRecord>(
      "person_exercises",
      { id: `eq.${row.id}` },
      {
        is_enabled: enabled,
        ...(enabled ? {} : { is_quick_log: false, quick_log_order: null }),
      },
    );
  } else {
    await supabasePublicInsert<PersonExerciseRecord>("person_exercises", {
      person_id: targetPerson.id,
      exercise_id: exerciseId,
      is_enabled: enabled,
      location_scope: "both",
      is_quick_log: false,
      quick_log_order: null,
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
    select: "id,person_id,exercise_id,is_enabled,location_scope,is_quick_log,quick_log_order",
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
      is_quick_log: false,
      quick_log_order: null,
    });
  }
  return { ok: true };
}

export async function setExerciseQuickLogClient(
  exerciseId: string,
  quickLog: boolean,
  personId?: string,
) {
  const targetPerson = await getTargetPerson(personId);
  if (!targetPerson) throw new Error("Claim your profile first.");
  const existing = await supabasePublicSelect<PersonExerciseRecord>("person_exercises", {
    select: "id,person_id,exercise_id,is_enabled,location_scope,is_quick_log,quick_log_order",
    person_id: `eq.${targetPerson.id}`,
    exercise_id: `eq.${exerciseId}`,
    limit: 1,
  });
  let quickLogOrder: number | null = null;
  if (quickLog) {
    const current = await supabasePublicSelect<PersonExerciseRecord>("person_exercises", {
      select: "id,person_id,exercise_id,is_enabled,location_scope,is_quick_log,quick_log_order",
      person_id: `eq.${targetPerson.id}`,
      is_quick_log: "eq.true",
      order: "quick_log_order.desc",
      limit: 1,
    });
    quickLogOrder = (current[0]?.quick_log_order ?? -1) + 1;
  }
  const row = existing[0];
  if (row) {
    await supabasePublicUpdate<PersonExerciseRecord>(
      "person_exercises",
      { id: `eq.${row.id}` },
      {
        is_quick_log: quickLog,
        quick_log_order: quickLogOrder,
        ...(quickLog ? { is_enabled: true } : {}),
      },
    );
  } else {
    await supabasePublicInsert<PersonExerciseRecord>("person_exercises", {
      person_id: targetPerson.id,
      exercise_id: exerciseId,
      is_enabled: quickLog,
      location_scope: "both",
      is_quick_log: quickLog,
      quick_log_order: quickLogOrder,
    });
  }
  return { ok: true };
}
