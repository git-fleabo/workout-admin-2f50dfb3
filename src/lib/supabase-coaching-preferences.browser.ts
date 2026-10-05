import {
  DEFAULT_COACHING_PREFERENCES,
  normaliseCoachingPreferences,
  type CoachingPreferences,
} from "./coaching-preferences";
import { getCurrentPerson } from "./supabase-people.browser";
import {
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";

type CoachingPreferencesRow = {
  person_id: string;
  primary_focus_id: string;
  secondary_focus_ids: string[];
  maintenance_focus_ids: string[];
  weekly_training_days: number;
  weekly_minutes: number;
  max_demanding_days: number;
};

function mapRow(row: CoachingPreferencesRow): CoachingPreferences {
  return normaliseCoachingPreferences({
    primaryFocusId: row.primary_focus_id,
    secondaryFocusIds: row.secondary_focus_ids ?? [],
    maintenanceFocusIds: row.maintenance_focus_ids ?? [],
    weeklyTrainingDays: row.weekly_training_days,
    weeklyMinutes: row.weekly_minutes,
    maxDemandingDays: row.max_demanding_days,
    saved: true,
  });
}

async function requirePerson() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("Connect your training profile first.");
  return person;
}

export async function getCoachingPreferencesClient() {
  const person = await requirePerson();
  const rows = await supabasePublicSelect<CoachingPreferencesRow>("coaching_preferences", {
    select:
      "person_id,primary_focus_id,secondary_focus_ids,maintenance_focus_ids,weekly_training_days,weekly_minutes,max_demanding_days",
    person_id: `eq.${person.id}`,
    limit: 1,
  });
  return rows[0] ? mapRow(rows[0]) : { ...DEFAULT_COACHING_PREFERENCES };
}

export async function saveCoachingPreferencesClient(value: CoachingPreferences) {
  const person = await requirePerson();
  const preferences = normaliseCoachingPreferences(value);
  const body = {
    primary_focus_id: preferences.primaryFocusId,
    secondary_focus_ids: preferences.secondaryFocusIds,
    maintenance_focus_ids: preferences.maintenanceFocusIds,
    weekly_training_days: preferences.weeklyTrainingDays,
    weekly_minutes: preferences.weeklyMinutes,
    max_demanding_days: preferences.maxDemandingDays,
  };
  const existing = await supabasePublicSelect<{ person_id: string }>("coaching_preferences", {
    select: "person_id",
    person_id: `eq.${person.id}`,
    limit: 1,
  });
  const rows = existing[0]
    ? await supabasePublicUpdate<CoachingPreferencesRow>(
        "coaching_preferences",
        { person_id: `eq.${person.id}` },
        body,
      )
    : await supabasePublicInsert<CoachingPreferencesRow>("coaching_preferences", {
        person_id: person.id,
        ...body,
      });
  if (!rows[0]) throw new Error("Your coaching setup could not be saved.");
  return mapRow(rows[0]);
}
