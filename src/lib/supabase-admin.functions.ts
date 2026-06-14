import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { appSecretAuth } from "./auth-middleware";
import {
  supabaseDelete,
  supabaseInsert,
  supabaseSelect,
  supabaseUpdate,
} from "./supabase.server";
import type { GoalRow, LibraryRow } from "./admin.functions";

type ExerciseRecord = {
  source_row: number | null;
  focus_area: string | null;
  name: string;
  equipment: string | null;
  default_metric: string | null;
  suggested_sets: string | null;
  suggested_reps: string | null;
  notes: string | null;
  activity_types: { name: string | null } | null;
};

type GoalRecord = {
  source_row: number | null;
  goal: string;
  metric: string | null;
  target: string | null;
  period: string | null;
  notes: string | null;
};

type IdRecord = { id: string };

type PersonRecord = { id: string };

type GoalMutationRecord = GoalRecord & { id: string };

const shortText = (max = 200) => z.string().max(max).default("");
const longText = (max = 2000) => z.string().max(max).default("");

const GoalInput = z.object({
  goal: z.string().min(1).max(150),
  metric: shortText(60),
  target: shortText(60),
  period: shortText(40),
  notes: longText(500),
});

const UpdateGoalInput = z.object({
  row: z.number().int().min(2).max(500),
  fields: GoalInput,
});

const DeleteGoalInput = z.object({
  row: z.number().int().min(2).max(500),
});

async function getNoamPersonId() {
  const people = await supabaseSelect<PersonRecord>("people", {
    select: "id",
    display_name: "eq.Noam",
    email: "is.null",
    order: "created_at.asc",
    limit: 1,
  });
  const id = people[0]?.id;
  if (!id) throw new Error("Noam person row missing in Supabase.");
  return id;
}

export const listExercisesFromSupabase = createServerFn({ method: "GET" })
  .middleware([appSecretAuth])
  .handler(async () => {
    const rows = await supabaseSelect<ExerciseRecord>("exercises", {
      select:
        "source_row,focus_area,name,equipment,default_metric,suggested_sets,suggested_reps,notes,activity_types(name)",
      source_sheet: "eq.Exercise Library",
      order: "source_row.asc",
    });
    const items: LibraryRow[] = rows.map((r) => ({
      row: r.source_row ?? 0,
      workoutType: r.activity_types?.name ?? "",
      focusArea: r.focus_area ?? "",
      name: r.name,
      equipment: r.equipment ?? "",
      metric: r.default_metric ?? "",
      suggestedSets: r.suggested_sets ?? "",
      suggestedReps: r.suggested_reps ?? "",
      notes: r.notes ?? "",
    }));
    return { items };
  });

export const listGoalsFromSupabase = createServerFn({ method: "GET" })
  .middleware([appSecretAuth])
  .handler(async () => {
    const rows = await supabaseSelect<GoalRecord>("goals", {
      select: "source_row,goal,metric,target,period,notes",
      source_sheet: "eq.Goals",
      order: "source_row.asc",
    });
    const items: GoalRow[] = rows.map((r) => ({
      row: r.source_row ?? 0,
      goal: r.goal,
      metric: r.metric ?? "",
      target: r.target ?? "",
      period: r.period ?? "",
      notes: r.notes ?? "",
    }));
    return { items };
  });

async function findNextGoalSourceRow() {
  const rows = await supabaseSelect<Pick<GoalRecord, "source_row">>("goals", {
    select: "source_row",
    source_sheet: "eq.Goals",
    order: "source_row.desc",
    limit: 1,
  });
  return Math.max(2, (rows[0]?.source_row ?? 1) + 1);
}

export const addGoalToSupabase = createServerFn({ method: "POST" })
  .middleware([appSecretAuth])
  .inputValidator((d: unknown) => GoalInput.parse(d))
  .handler(async ({ data }) => {
    const [personId, row] = await Promise.all([
      getNoamPersonId(),
      findNextGoalSourceRow(),
    ]);
    const inserted = await supabaseInsert<GoalMutationRecord>("goals", {
      person_id: personId,
      goal: data.goal,
      metric: data.metric,
      target: data.target,
      period: data.period,
      notes: data.notes,
      source_sheet: "Goals",
      source_row: row,
    });
    return { ok: true, row: inserted[0]?.source_row ?? row };
  });

export const updateGoalInSupabase = createServerFn({ method: "POST" })
  .middleware([appSecretAuth])
  .inputValidator((d: unknown) => UpdateGoalInput.parse(d))
  .handler(async ({ data }) => {
    const { row, fields } = data;
    await supabaseUpdate<GoalMutationRecord>(
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
  });

export const deleteGoalFromSupabase = createServerFn({ method: "POST" })
  .middleware([appSecretAuth])
  .inputValidator((d: unknown) => DeleteGoalInput.parse(d))
  .handler(async ({ data }) => {
    await supabaseDelete<GoalMutationRecord>("goals", {
      source_sheet: "eq.Goals",
      source_row: `eq.${data.row}`,
    });
    return { ok: true };
  });

export const getSupabaseImportSummary = createServerFn({ method: "GET" })
  .middleware([appSecretAuth])
  .handler(async () => {
    const [
      exercises,
      goals,
      sessions,
      entries,
      sets,
      metrics,
      oneRmTests,
      bodyweightLogs,
    ] = await Promise.all([
      supabaseSelect<IdRecord>("exercises", { select: "id" }),
      supabaseSelect<IdRecord>("goals", { select: "id" }),
      supabaseSelect<IdRecord>("sessions", { select: "id" }),
      supabaseSelect<IdRecord>("session_entries", { select: "id" }),
      supabaseSelect<IdRecord>("entry_sets", { select: "id" }),
      supabaseSelect<IdRecord>("entry_metrics", { select: "id" }),
      supabaseSelect<IdRecord>("one_rm_tests", { select: "id" }),
      supabaseSelect<IdRecord>("bodyweight_logs", { select: "id" }),
    ]);
    return {
      exercises: exercises.length,
      goals: goals.length,
      sessions: sessions.length,
      entries: entries.length,
      sets: sets.length,
      metrics: metrics.length,
      oneRmTests: oneRmTests.length,
      bodyweightLogs: bodyweightLogs.length,
    };
  });
