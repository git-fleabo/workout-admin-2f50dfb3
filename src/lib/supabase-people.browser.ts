import {
  getSupabaseSession,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";

export type PersonRecord = {
  id: string;
  auth_user_id: string | null;
  display_name: string;
};

export async function getCurrentPerson() {
  const session = getSupabaseSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Sign in to Supabase first.");
  const people = await supabasePublicSelect<PersonRecord>("people", {
    select: "id,auth_user_id,display_name",
    auth_user_id: `eq.${userId}`,
    limit: 1,
  });
  return people[0] ?? null;
}

export async function claimNoamProfile() {
  const session = getSupabaseSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Sign in to Supabase first.");
  const claimable = await supabasePublicSelect<PersonRecord>("people", {
    select: "id,auth_user_id,display_name",
    display_name: "eq.Noam",
    auth_user_id: "is.null",
    limit: 1,
  });
  const person = claimable[0];
  if (!person) return getCurrentPerson();
  const updated = await supabasePublicUpdate<PersonRecord>(
    "people",
    { id: `eq.${person.id}` },
    { auth_user_id: userId },
  );
  return updated[0] ?? null;
}

export async function listManagedPeopleClient() {
  return supabasePublicSelect<PersonRecord>("people", {
    select: "id,auth_user_id,display_name",
    order: "display_name.asc",
  });
}
