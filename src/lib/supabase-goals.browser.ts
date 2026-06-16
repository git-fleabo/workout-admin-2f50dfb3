import {
  supabasePublicDelete,
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import { getCurrentPerson, claimNoamProfile } from "./supabase-people.browser";
import type { GoalRow } from "./training-types";

type GoalRecord = {
  id: string;
  person_id: string;
  source_row: number | null;
  goal: string;
  metric: string | null;
  target: string | null;
  period: string | null;
  notes: string | null;
};

type GoalMutationRecord = GoalRecord & { id: string };
type GoalCheckinRecord = {
  id: string;
  goal_id: string;
  checked_date: string;
  note: string | null;
  created_at: string;
};

export type GoalFields = Omit<GoalRow, "id" | "row" | "checkins">;
export { claimNoamProfile };

export async function listGoalsClient() {
  const person = await getCurrentPerson();
  if (!person) return { needsProfileClaim: true as const, items: [] as GoalRow[] };
  const [rows, checkins] = await Promise.all([
    supabasePublicSelect<GoalRecord>("goals", {
      select: "id,person_id,source_row,goal,metric,target,period,notes",
      order: "source_row.asc",
    }),
    supabasePublicSelect<GoalCheckinRecord>("goal_checkins", {
      select: "id,goal_id,checked_date,note,created_at",
      order: "checked_date.desc",
      limit: 500,
    }),
  ]);
  const checkinsByGoal = new Map<string, GoalCheckinRecord[]>();
  for (const checkin of checkins) {
    const list = checkinsByGoal.get(checkin.goal_id) ?? [];
    list.push(checkin);
    checkinsByGoal.set(checkin.goal_id, list);
  }
  return {
    needsProfileClaim: false as const,
    items: rows.map((r) => ({
      id: r.id,
      row: r.source_row ?? 0,
      goal: r.goal,
      metric: r.metric ?? "",
      target: r.target ?? "",
      period: r.period ?? "",
      notes: r.notes ?? "",
      checkins: (checkinsByGoal.get(r.id) ?? [])
        .sort((a, b) => b.checked_date.localeCompare(a.checked_date))
        .slice(0, 8)
        .map((checkin) => ({
          id: checkin.id,
          date: checkin.checked_date,
          note: checkin.note ?? "",
          createdAt: checkin.created_at,
        })),
    })),
  };
}

async function requirePerson() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("Claim your profile first.");
  return person;
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
  const [person, row] = await Promise.all([requirePerson(), findNextGoalSourceRow()]);
  const inserted = await supabasePublicInsert<GoalMutationRecord>("goals", {
    person_id: person.id,
    goal: fields.goal,
    metric: fields.metric,
    target: fields.target,
    period: fields.period,
    notes: fields.notes,
    status: "active",
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

export async function addGoalCheckinClient(goalId: string, date: string) {
  const person = await requirePerson();
  await supabasePublicInsert<GoalCheckinRecord>("goal_checkins", {
    person_id: person.id,
    goal_id: goalId,
    checked_date: date,
  });
  return { ok: true };
}

export async function deleteGoalCheckinClient(id: string) {
  if (!id) throw new Error("Missing check-in id.");
  await supabasePublicDelete<GoalCheckinRecord>("goal_checkins", { id: `eq.${id}` });
  return { ok: true };
}
