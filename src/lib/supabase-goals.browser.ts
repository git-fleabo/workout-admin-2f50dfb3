import {
  getSupabaseSession,
  supabasePublicDelete,
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import type { GoalRow } from "./admin.functions";

type PersonRecord = {
  id: string;
  auth_user_id: string | null;
  display_name: string;
};

type GoalRecord = {
  source_row: number | null;
  goal: string;
  metric: string | null;
  target: string | null;
  period: string | null;
  notes: string | null;
};

type GoalMutationRecord = GoalRecord & { id: string };

export type GoalFields = Omit<GoalRow, "row">;

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

export async function listGoalsClient() {
  const person = await getCurrentPerson();
  if (!person) return { needsProfileClaim: true as const, items: [] as GoalRow[] };
  const rows = await supabasePublicSelect<GoalRecord>("goals", {
    select: "source_row,goal,metric,target,period,notes",
    order: "source_row.asc",
  });
  return {
    needsProfileClaim: false as const,
    items: rows.map((r) => ({
      row: r.source_row ?? 0,
      goal: r.goal,
      metric: r.metric ?? "",
      target: r.target ?? "",
      period: r.period ?? "",
      notes: r.notes ?? "",
    })),
  };
}

async function findNextGoalSourceRow() {
  const rows = await supabasePublicSelect<Pick<GoalRecord, "source_row">>("goals", {
    select: "source_row",
    source_sheet: "eq.Goals",
    order: "source_row.desc",
    limit: 1,
  });
  return Math.max(2, (rows[0]?.source_row ?? 1) + 1);
}

export async function addGoalClient(fields: GoalFields) {
  const [person, row] = await Promise.all([getCurrentPerson(), findNextGoalSourceRow()]);
  if (!person) throw new Error("Claim your profile first.");
  const inserted = await supabasePublicInsert<GoalMutationRecord>("goals", {
    person_id: person.id,
    goal: fields.goal,
    metric: fields.metric,
    target: fields.target,
    period: fields.period,
    notes: fields.notes,
    source_sheet: "Goals",
    source_row: row,
  });
  return { ok: true, row: inserted[0]?.source_row ?? row };
}

export async function updateGoalClient(row: number, fields: GoalFields) {
  await supabasePublicUpdate<GoalMutationRecord>(
    "goals",
    { source_sheet: "eq.Goals", source_row: `eq.${row}` },
    {
      goal: fields.goal,
      metric: fields.metric,
      target: fields.target,
      period: fields.period,
      notes: fields.notes,
    },
  );
  return { ok: true };
}

export async function deleteGoalClient(row: number) {
  await supabasePublicDelete<GoalMutationRecord>("goals", {
    source_sheet: "eq.Goals",
    source_row: `eq.${row}`,
  });
  return { ok: true };
}
