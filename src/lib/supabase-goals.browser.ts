import {
  supabasePublicDelete,
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import { getCurrentPerson, claimNoamProfile } from "./supabase-people.browser";
import type { GoalRow } from "./training-types";

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
export { claimNoamProfile };

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
