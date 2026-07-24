import {
  supabasePublicDelete,
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import { getCurrentPerson, claimNoamProfile } from "./supabase-people.browser";
import type { GoalActivitySession } from "./goal-progress";
import type { GoalMetric, GoalRow, GoalStatus, GoalType } from "./training-types";

type GoalRecord = {
  id: string;
  person_id: string;
  source_row: number | null;
  created_at: string;
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
type GoalSessionRecord = {
  id: string;
  session_date: string;
  duration_minutes: number | string | null;
  session_entries: Array<{
    completed: boolean;
    entry_sets: Array<{ duration_seconds: number | string | null }> | null;
    entry_metrics: Array<{
      metric_key: string;
      metric_value: number | string | null;
      metric_text: string | null;
    }> | null;
  }> | null;
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
        "id,person_id,source_row,created_at,goal,goal_type,status,exercise_id,tracking_mode,goal_metric,target_value,target_unit,starting_value,deadline,metric,target,period,notes",
      order: "created_at.asc",
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
    items: rows.map((r, index) => ({
      id: r.id,
      row: index + 1,
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

export async function addGoalClient(fields: GoalFields) {
  const person = await requirePerson();
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
  });
  return { ok: true, row: inserted[0] ? "Supabase" : null };
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

export async function getGoalActivityClient(): Promise<GoalActivitySession[]> {
  await requirePerson();
  const sessions = await supabasePublicSelect<GoalSessionRecord>("sessions", {
    select:
      "id,session_date,duration_minutes,session_entries(completed,entry_sets(duration_seconds),entry_metrics(metric_key,metric_value,metric_text))",
    completed: "eq.true",
    order: "session_date.asc",
    limit: 2000,
  });
  return sessions
    .map((session) => {
      const entries = session.session_entries?.filter((entry) => entry.completed) ?? [];
      if (!entries.length) return null;
      return {
        id: session.id,
        date: session.session_date,
        minutes: goalSessionMinutes(session.duration_minutes, entries),
      };
    })
    .filter((session): session is GoalActivitySession => session != null);
}

function goalSessionMinutes(
  sessionMinutes: number | string | null,
  entries: NonNullable<GoalSessionRecord["session_entries"]>,
) {
  const recorded = finitePositive(sessionMinutes);
  if (recorded != null) return recorded;

  const metricMinutes = entries.reduce((total, entry) => {
    const minutes = entry.entry_metrics?.find((metric) => metric.metric_key === "duration_minutes");
    const hours = entry.entry_metrics?.find((metric) => metric.metric_key === "hours");
    return (
      total +
      (finitePositive(minutes?.metric_value ?? minutes?.metric_text) ??
        (finitePositive(hours?.metric_value ?? hours?.metric_text) ?? 0) * 60)
    );
  }, 0);
  if (metricMinutes > 0) return metricMinutes;

  return (
    entries.reduce(
      (total, entry) =>
        total +
        (entry.entry_sets ?? []).reduce(
          (setTotal, set) => setTotal + (finitePositive(set.duration_seconds) ?? 0),
          0,
        ),
      0,
    ) / 60
  );
}

function finitePositive(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
