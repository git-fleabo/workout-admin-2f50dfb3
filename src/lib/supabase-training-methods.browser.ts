import {
  getCurrentPerson,
  listManagedPeopleClient,
  type PersonRecord,
} from "./supabase-people.browser";
import {
  supabasePublicDelete,
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";

export type TrainingMethodFamily = "exercise_group" | "set_method" | "timed_density";

export type TrainingMethodConfig = Record<string, number | string | boolean>;

type TrainingMethodRecord = {
  id: string;
  person_id: string | null;
  system_key: string | null;
  name: string;
  family: TrainingMethodFamily;
  description: string | null;
  default_config: TrainingMethodConfig | null;
  is_active: boolean;
};

type PersonTrainingMethodRecord = {
  person_id: string;
  training_method_id: string;
  is_enabled: boolean;
  default_config: TrainingMethodConfig | null;
};

export type TrainingMethod = {
  id: string;
  systemKey: string | null;
  name: string;
  family: TrainingMethodFamily;
  description: string;
  defaultConfig: TrainingMethodConfig;
  isSystem: boolean;
  isEnabled: boolean;
  isActive: boolean;
};

export type TrainingMethodFields = Pick<
  TrainingMethod,
  "name" | "family" | "description" | "defaultConfig"
>;

async function targetPerson(personId?: string) {
  if (!personId) return getCurrentPerson();
  const people = await supabasePublicSelect<PersonRecord>("people", {
    select: "id,auth_user_id,display_name",
    id: `eq.${personId}`,
    limit: 1,
  });
  return people[0] ?? null;
}

export async function listTrainingMethodsClient(personId?: string) {
  const [person, people] = await Promise.all([targetPerson(personId), listManagedPeopleClient()]);
  if (!person) throw new Error("Claim your profile first.");
  const [methods, settings] = await Promise.all([
    supabasePublicSelect<TrainingMethodRecord>("training_methods", {
      select: "id,person_id,system_key,name,family,description,default_config,is_active",
      order: "family.asc,name.asc",
    }),
    supabasePublicSelect<PersonTrainingMethodRecord>("person_training_methods", {
      select: "person_id,training_method_id,is_enabled,default_config",
      person_id: `eq.${person.id}`,
    }),
  ]);
  const settingsByMethod = new Map(
    settings.map((setting) => [setting.training_method_id, setting]),
  );
  return {
    people,
    selectedPersonId: person.id,
    items: methods.map<TrainingMethod>((method) => {
      const setting = settingsByMethod.get(method.id);
      return {
        id: method.id,
        systemKey: method.system_key,
        name: method.name,
        family: method.family,
        description: method.description ?? "",
        defaultConfig: { ...(method.default_config ?? {}), ...(setting?.default_config ?? {}) },
        isSystem: method.person_id == null,
        isEnabled: method.is_active && (setting?.is_enabled ?? true),
        isActive: method.is_active,
      };
    }),
  };
}

export async function addTrainingMethodClient(fields: TrainingMethodFields, personId?: string) {
  const person = await targetPerson(personId);
  if (!person) throw new Error("Claim your profile first.");
  await supabasePublicInsert("training_methods", {
    person_id: person.id,
    name: fields.name.trim(),
    family: fields.family,
    description: fields.description.trim() || null,
    default_config: fields.defaultConfig,
  });
  return { ok: true };
}

export async function updateTrainingMethodClient(id: string, fields: TrainingMethodFields) {
  await supabasePublicUpdate(
    "training_methods",
    { id: `eq.${id}`, person_id: "not.is.null" },
    {
      name: fields.name.trim(),
      family: fields.family,
      description: fields.description.trim() || null,
      default_config: fields.defaultConfig,
    },
  );
  return { ok: true };
}

export async function duplicateTrainingMethodClient(method: TrainingMethod, personId?: string) {
  return addTrainingMethodClient(
    {
      name: `${method.name} copy`,
      family: method.family,
      description: method.description,
      defaultConfig: method.defaultConfig,
    },
    personId,
  );
}

export async function setTrainingMethodEnabledClient(
  method: TrainingMethod,
  enabled: boolean,
  personId?: string,
) {
  const person = await targetPerson(personId);
  if (!person) throw new Error("Claim your profile first.");
  if (!method.isSystem) {
    await supabasePublicUpdate(
      "training_methods",
      { id: `eq.${method.id}`, person_id: `eq.${person.id}` },
      { is_active: enabled },
    );
    return { ok: true };
  }
  const existing = await supabasePublicSelect<PersonTrainingMethodRecord>(
    "person_training_methods",
    {
      select: "person_id,training_method_id,is_enabled,default_config",
      person_id: `eq.${person.id}`,
      training_method_id: `eq.${method.id}`,
      limit: 1,
    },
  );
  if (existing[0]) {
    await supabasePublicUpdate(
      "person_training_methods",
      { person_id: `eq.${person.id}`, training_method_id: `eq.${method.id}` },
      { is_enabled: enabled },
    );
  } else {
    await supabasePublicInsert("person_training_methods", {
      person_id: person.id,
      training_method_id: method.id,
      is_enabled: enabled,
    });
  }
  return { ok: true };
}

export async function deleteTrainingMethodClient(id: string) {
  await supabasePublicDelete("training_methods", { id: `eq.${id}`, person_id: "not.is.null" });
  return { ok: true };
}
