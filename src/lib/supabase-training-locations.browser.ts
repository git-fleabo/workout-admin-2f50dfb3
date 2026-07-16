import {
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import { getCurrentPerson } from "./supabase-people.browser";

export type TrainingLocationKind = "home" | "gym" | "other";

export type ManagedTrainingLocation = {
  id: string;
  name: string;
  kind: TrainingLocationKind;
  isActive: boolean;
};

export type TrainingLocationFields = {
  name: string;
  kind: TrainingLocationKind;
};

type TrainingLocationRecord = {
  id: string;
  person_id: string;
  name: string;
  kind: TrainingLocationKind;
  is_active: boolean;
};

async function requirePerson() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("Connect your training profile first.");
  return person;
}

export async function listManagedTrainingLocationsClient() {
  const person = await getCurrentPerson();
  if (!person) {
    return { needsProfileClaim: true as const, items: [] as ManagedTrainingLocation[] };
  }

  const rows = await supabasePublicSelect<TrainingLocationRecord>("training_locations", {
    select: "id,person_id,name,kind,is_active",
    person_id: `eq.${person.id}`,
    order: "is_active.desc,kind.asc,name.asc",
  });

  return {
    needsProfileClaim: false as const,
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
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
