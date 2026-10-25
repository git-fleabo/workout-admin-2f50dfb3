import { getCurrentPerson } from "./supabase-people.browser";
import { supabaseSelectAll } from "./supabase-pagination.browser";
import { supabasePublicRpc } from "./supabase-public";

export type TrainingRestDay = { rest_date: string };

export async function listTrainingRestDaysClient() {
  const person = await getCurrentPerson();
  return supabaseSelectAll<TrainingRestDay>("training_rest_days", {
    select: "rest_date",
    person_id: `eq.${person.id}`,
    order: "rest_date.asc",
  });
}

export async function setTrainingRestDayClient(date: string, rest: boolean, restoreDates = true) {
  const person = await getCurrentPerson();
  return supabasePublicRpc<number>("set_training_rest_day", {
    p_person_id: person.id,
    p_date: date,
    p_rest: rest,
    p_restore_dates: restoreDates,
  });
}
