import {
  supabasePublicDelete,
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import { getCurrentPerson, claimNoamProfile } from "./supabase-people.browser";
import type { GoalMetric, GoalRow, GoalStatus, GoalType } from "./training-types";

type GoalRecord = {
  id: string;
  person_id: string;
  source_row: number | null;
  goal: string;
  goal_type: GoalType;
  status: GoalStatus;
  exercise_id: string | null;
  tracking_mode: string | null;
  goal_metric: GoalMetric | null;
  target_value: number | string | null;
  target_unit: string | null;
  starting_value: number | string | null;
  deadline: string | null;
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

export type GoalFields = Omit<GoalRow, "id" | "row" | "checkins" | "status">;
export { claimNoamProfile };

function numericOrNull(value: number | string | null) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function listGoalsClient() {
  const person = await getCurrentPerson();
  if (!person) return { needsProfileClaim: true as const, items: [] as GoalRow[] };
  const [rows, checkins] = await Promise.all([
    supabasePublicSelect<GoalRecord>("goals", {
      select:
        "id,person_id,source_row,goal,goal_type,status,exercise_id,tracking_mode,goal_metric,target_value,target_unit,starting_value,deadline,metric,target,period,notes",
      order: "source_row.asc",
    }),
    supabasePublicSelect<GoalCheckinRecord>("goal_checkins", {
      select: "id,goal_id,checked_date,note,created_at",
      order: "checked_date.desc",
      limit: 2000,
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
      goalType: r.goal_type ?? "legacy",
      status: r.status ?? "active",
      exerciseId: r.exercise_id ?? "",
      trackingMode: r.tracking_mode ?? "",
      goalMetric: (r.goal_metric ?? "") as GoalMetric | "",
      targetValue: numericOrNull(r.target_value),
      targetUnit: r.target_unit ?? "",
      startingValue: numericOrNull(r.starting_value),
      deadline: r.deadline ?? "",
      metric: r.metric ?? "",
      target: r.target ?? "",
      period: r.period ?? "",
      notes: r.notes ?? "",
      checkins: (checkinsByGoal.get(r.id) ?? [])
        .sort((a, b) => b.checked_date.localeCompare(a.checked_date))
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
    goal_type: fields.goalType,
    exercise_id: fields.exerciseId || null,
    tracking_mode: fields.trackingMode || null,
    goal_metric: fields.goalMetric || null,
    target_value: fields.targetValue,
    target_unit: fields.targetUnit || null,
    starting_value: fields.startingValue,
    deadline: fields.deadline || null,
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

export async function updateGoalClient(id: string, fields: GoalFields) {
  await supabasePublicUpdate<GoalMutationRecord>(
    "goals",
    { id: `eq.${id}` },
    {
      goal: fields.goal,
      goal_type: fields.goalType,
      exercise_id: fields.exerciseId || null,
      tracking_mode: fields.trackingMode || null,
      goal_metric: fields.goalMetric || null,
      target_value: fields.targetValue,
      target_unit: fields.targetUnit || null,
      starting_value: fields.startingValue,
      deadline: fields.deadline || null,
      metric: fields.metric,
      target: fields.target,
      period: fields.period,
      notes: fields.notes,
    },
  );
  return { ok: true };
}

export async function updateGoalStatusClient(id: string, status: GoalStatus) {
  await supabasePublicUpdate<GoalMutationRecord>("goals", { id: `eq.${id}` }, { status });
  return { ok: true };
}

export async function deleteGoalClient(id: string) {
  await supabasePublicDelete<GoalMutationRecord>("goals", { id: `eq.${id}` });
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
