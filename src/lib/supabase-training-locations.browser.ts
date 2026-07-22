import {
  supabasePublicDelete,
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import { getCurrentPerson } from "./supabase-people.browser";

export type TrainingLocationKind = "home" | "gym" | "other";
export type EquipmentCategory =
  | "free_weights"
  | "fixed_equipment"
  | "cardio"
  | "functional"
  | "accessory";
export type EquipmentCircuitGroup =
  | "mat"
  | "kettlebell"
  | "dumbbell"
  | "barbell"
  | "bar_rings"
  | "cardio_machine"
  | "cable_machine"
  | "specialist";

export type ManagedEquipmentItem = {
  id: string;
  name: string;
  category: EquipmentCategory;
  circuitGroup: EquipmentCircuitGroup;
  sortOrder: number;
  isActive: boolean;
};

export type ManagedTrainingLocation = {
  id: string;
  name: string;
  kind: TrainingLocationKind;
  isActive: boolean;
  equipmentIds: string[];
};

export type TrainingLocationFields = {
  name: string;
  kind: TrainingLocationKind;
};

export type EquipmentItemFields = {
  name: string;
  category: EquipmentCategory;
  circuitGroup: EquipmentCircuitGroup;
};

type TrainingLocationRecord = {
  id: string;
  person_id: string;
  name: string;
  kind: TrainingLocationKind;
  is_active: boolean;
};

type EquipmentItemRecord = {
  id: string;
  person_id: string;
  name: string;
  category: EquipmentCategory;
  circuit_group: EquipmentCircuitGroup;
  sort_order: number;
  is_active: boolean;
};

type TrainingLocationEquipmentRecord = {
  location_id: string;
  equipment_item_id: string;
};

async function requirePerson() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("Connect your training profile first.");
  return person;
}

export async function listManagedTrainingLocationsClient() {
  const person = await getCurrentPerson();
  if (!person) {
    return {
      needsProfileClaim: true as const,
      items: [] as ManagedTrainingLocation[],
      equipmentItems: [] as ManagedEquipmentItem[],
    };
  }

  const [rows, equipmentRows, assignmentRows] = await Promise.all([
    supabasePublicSelect<TrainingLocationRecord>("training_locations", {
      select: "id,person_id,name,kind,is_active",
      person_id: `eq.${person.id}`,
      order: "is_active.desc,kind.asc,name.asc",
    }),
    supabasePublicSelect<EquipmentItemRecord>("equipment_items", {
      select: "id,person_id,name,category,circuit_group,sort_order,is_active",
      person_id: `eq.${person.id}`,
      order: "is_active.desc,sort_order.asc,name.asc",
    }),
    supabasePublicSelect<TrainingLocationEquipmentRecord>("training_location_equipment", {
      select: "location_id,equipment_item_id",
    }),
  ]);
  const assignments = new Map<string, string[]>();
  for (const assignment of assignmentRows) {
    const ids = assignments.get(assignment.location_id) ?? [];
    ids.push(assignment.equipment_item_id);
    assignments.set(assignment.location_id, ids);
  }

  return {
    needsProfileClaim: false as const,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      isActive: row.is_active,
      equipmentIds: assignments.get(row.id) ?? [],
    })),
    equipmentItems: equipmentRows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      circuitGroup: row.circuit_group,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    })),
  };
}

export async function addTrainingLocationClient(fields: TrainingLocationFields) {
  const person = await requirePerson();
  const rows = await supabasePublicInsert<TrainingLocationRecord>("training_locations", {
    person_id: person.id,
    name: fields.name.trim(),
    kind: fields.kind,
    is_active: true,
  });
  return rows[0] ?? null;
}

export async function updateTrainingLocationClient(id: string, fields: TrainingLocationFields) {
  const person = await requirePerson();
  const rows = await supabasePublicUpdate<TrainingLocationRecord>(
    "training_locations",
    { id: `eq.${id}`, person_id: `eq.${person.id}` },
    { name: fields.name.trim(), kind: fields.kind },
  );
  return rows[0] ?? null;
}

export async function setTrainingLocationActiveClient(id: string, isActive: boolean) {
  const person = await requirePerson();
  const rows = await supabasePublicUpdate<TrainingLocationRecord>(
    "training_locations",
    { id: `eq.${id}`, person_id: `eq.${person.id}` },
    { is_active: isActive },
  );
  return rows[0] ?? null;
}

export async function addEquipmentItemClient(fields: EquipmentItemFields) {
  const person = await requirePerson();
  const rows = await supabasePublicInsert<EquipmentItemRecord>("equipment_items", {
    person_id: person.id,
    name: fields.name.trim(),
    category: fields.category,
    circuit_group: fields.circuitGroup,
    is_active: true,
  });
  return rows[0] ?? null;
}

export async function updateEquipmentItemClient(id: string, fields: EquipmentItemFields) {
  const person = await requirePerson();
  const rows = await supabasePublicUpdate<EquipmentItemRecord>(
    "equipment_items",
    { id: `eq.${id}`, person_id: `eq.${person.id}` },
    {
      name: fields.name.trim(),
      category: fields.category,
      circuit_group: fields.circuitGroup,
    },
  );
  return rows[0] ?? null;
}

export async function setEquipmentItemActiveClient(id: string, isActive: boolean) {
  const person = await requirePerson();
  const rows = await supabasePublicUpdate<EquipmentItemRecord>(
    "equipment_items",
    { id: `eq.${id}`, person_id: `eq.${person.id}` },
    { is_active: isActive },
  );
  return rows[0] ?? null;
}

export async function saveTrainingLocationEquipmentClient(
  locationId: string,
  equipmentIds: string[],
) {
  const person = await requirePerson();
  const location = await supabasePublicSelect<TrainingLocationRecord>("training_locations", {
    select: "id,person_id,name,kind,is_active",
    id: `eq.${locationId}`,
    person_id: `eq.${person.id}`,
    limit: 1,
  });
  if (!location[0]) throw new Error("That training location is no longer available.");

  const selectedIds = Array.from(new Set(equipmentIds));
  if (selectedIds.length) {
    const allowed = await supabasePublicSelect<EquipmentItemRecord>("equipment_items", {
      select: "id,person_id,name,category,circuit_group,sort_order,is_active",
      person_id: `eq.${person.id}`,
      id: `in.(${selectedIds.join(",")})`,
      is_active: "eq.true",
    });
    if (allowed.length !== selectedIds.length) {
      throw new Error("One or more equipment items are no longer available.");
    }
  }

  const existing = await supabasePublicSelect<TrainingLocationEquipmentRecord>(
    "training_location_equipment",
    {
      select: "location_id,equipment_item_id",
      location_id: `eq.${locationId}`,
    },
  );
  const existingIds = new Set(existing.map((row) => row.equipment_item_id));
  const selected = new Set(selectedIds);
  const removed = existing.filter((row) => !selected.has(row.equipment_item_id));
  const added = selectedIds.filter((id) => !existingIds.has(id));

  if (removed.length) {
    await supabasePublicDelete<TrainingLocationEquipmentRecord>("training_location_equipment", {
      location_id: `eq.${locationId}`,
      equipment_item_id: `in.(${removed.map((row) => row.equipment_item_id).join(",")})`,
    });
  }
  if (added.length) {
    await supabasePublicInsert<TrainingLocationEquipmentRecord>(
      "training_location_equipment",
      added.map((equipmentItemId) => ({
        location_id: locationId,
        equipment_item_id: equipmentItemId,
      })),
    );
  }

  return { locationId, equipmentIds: selectedIds };
}
