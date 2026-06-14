import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, Database, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { listExercises, listGoals } from "@/lib/admin.functions";
import {
  getSupabaseImportSummary,
  listExercisesFromSupabase,
  listGoalsFromSupabase,
} from "@/lib/supabase-admin.functions";
import type { GoalRow, LibraryRow } from "@/lib/training-types";

export const Route = createFileRoute("/data-check")({
  head: () => ({
    meta: [
      { title: "Data Check · Training Admin" },
      {
        name: "description",
        content: "Compare spreadsheet and Supabase training data during migration.",
      },
    ],
  }),
  component: DataCheckPage,
});

type RowComparison = {
  label: string;
  sheets: string | number;
  supabase: string | number;
  ok: boolean;
};

function DataCheckPage() {
  const listSheetExercises = useServerFn(listExercises);
  const listSheetGoals = useServerFn(listGoals);
  const listSupabaseExercises = useServerFn(listExercisesFromSupabase);
  const listSupabaseGoals = useServerFn(listGoalsFromSupabase);
  const getSummary = useServerFn(getSupabaseImportSummary);

  const sheetsExercises = useQuery({
    queryKey: ["data-check", "sheets-exercises"],
    queryFn: () => listSheetExercises(),
  });
  const sheetsGoals = useQuery({
    queryKey: ["data-check", "sheets-goals"],
    queryFn: () => listSheetGoals(),
  });
  const supabaseExercises = useQuery({
    queryKey: ["data-check", "supabase-exercises"],
    queryFn: () => listSupabaseExercises(),
  });
  const supabaseGoals = useQuery({
    queryKey: ["data-check", "supabase-goals"],
    queryFn: () => listSupabaseGoals(),
  });
  const summary = useQuery({
    queryKey: ["data-check", "supabase-summary"],
    queryFn: () => getSummary(),
  });

  const loading =
    sheetsExercises.isLoading ||
    sheetsGoals.isLoading ||
    supabaseExercises.isLoading ||
    supabaseGoals.isLoading ||
    summary.isLoading;

  const error =
    sheetsExercises.error ||
    sheetsGoals.error ||
    supabaseExercises.error ||
    supabaseGoals.error ||
    summary.error;

  const exerciseChecks = compareLibraryRows(
    sheetsExercises.data?.items ?? [],
    supabaseExercises.data?.items ?? [],
  );
  const goalChecks = compareGoalRows(
    sheetsGoals.data?.items ?? [],
    supabaseGoals.data?.items ?? [],
  );
  const allChecks = [...exerciseChecks, ...goalChecks];
  const mismatches = allChecks.filter((c) => !c.ok);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Data Check</h1>
          <p className="text-sm text-muted-foreground">
            Spreadsheet and Supabase migration comparison.
          </p>
        </div>
      </header>

      {loading ? (
        <Card className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading comparison…
        </Card>
      ) : error ? (
        <Card className="flex items-start gap-3 border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Data check failed</p>
            <p className="mt-1 text-xs">
              {error instanceof Error ? error.message : "Check runtime environment values."}
            </p>
          </div>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile label="Exercises" value={summary.data?.exercises ?? 0} />
            <SummaryTile label="Goals" value={summary.data?.goals ?? 0} />
            <SummaryTile label="Sessions" value={summary.data?.sessions ?? 0} />
            <SummaryTile label="Entries" value={summary.data?.entries ?? 0} />
            <SummaryTile label="Sets" value={summary.data?.sets ?? 0} />
            <SummaryTile label="Metrics" value={summary.data?.metrics ?? 0} />
            <SummaryTile label="1RM Tests" value={summary.data?.oneRmTests ?? 0} />
            <SummaryTile label="Bodyweight" value={summary.data?.bodyweightLogs ?? 0} />
          </section>

          <Card className="border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              {mismatches.length === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-400" />
              )}
              <h2 className="text-sm font-semibold">Library And Goals</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                {mismatches.length === 0 ? "Matched" : `${mismatches.length} mismatch(es)`}
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Check</th>
                    <th className="px-3 py-2 text-left font-medium">Sheets</th>
                    <th className="px-3 py-2 text-left font-medium">Supabase</th>
                    <th className="px-3 py-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allChecks.map((check) => (
                    <tr key={check.label} className="border-t border-border">
                      <td className="px-3 py-2">{check.label}</td>
                      <td className="px-3 py-2 text-muted-foreground">{check.sheets}</td>
                      <td className="px-3 py-2 text-muted-foreground">{check.supabase}</td>
                      <td className="px-3 py-2 text-right">
                        {check.ok ? (
                          <span className="text-emerald-400">OK</span>
                        ) : (
                          <span className="text-amber-400">Check</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Database className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold leading-none">{value}</p>
    </Card>
  );
}

function compareLibraryRows(sheets: LibraryRow[], supabase: LibraryRow[]): RowComparison[] {
  const checks: RowComparison[] = [
    {
      label: "Exercise count",
      sheets: sheets.length,
      supabase: supabase.length,
      ok: sheets.length === supabase.length,
    },
  ];
  const byRow = new Map(supabase.map((r) => [r.row, r]));
  for (const sheetRow of sheets) {
    const dbRow = byRow.get(sheetRow.row);
    if (!dbRow) {
      checks.push({
        label: `Exercise row ${sheetRow.row}`,
        sheets: sheetRow.name,
        supabase: "Missing",
        ok: false,
      });
      continue;
    }
    const sheetValue = librarySignature(sheetRow);
    const dbValue = librarySignature(dbRow);
    if (sheetValue !== dbValue) {
      checks.push({
        label: `Exercise row ${sheetRow.row}`,
        sheets: sheetValue,
        supabase: dbValue,
        ok: false,
      });
    }
  }
  return checks;
}

function compareGoalRows(sheets: GoalRow[], supabase: GoalRow[]): RowComparison[] {
  const checks: RowComparison[] = [
    {
      label: "Goal count",
      sheets: sheets.length,
      supabase: supabase.length,
      ok: sheets.length === supabase.length,
    },
  ];
  const byRow = new Map(supabase.map((r) => [r.row, r]));
  for (const sheetRow of sheets) {
    const dbRow = byRow.get(sheetRow.row);
    if (!dbRow) {
      checks.push({
        label: `Goal row ${sheetRow.row}`,
        sheets: sheetRow.goal,
        supabase: "Missing",
        ok: false,
      });
      continue;
    }
    const sheetValue = goalSignature(sheetRow);
    const dbValue = goalSignature(dbRow);
    if (sheetValue !== dbValue) {
      checks.push({
        label: `Goal row ${sheetRow.row}`,
        sheets: sheetValue,
        supabase: dbValue,
        ok: false,
      });
    }
  }
  return checks;
}

function librarySignature(row: LibraryRow) {
  return [
    row.workoutType,
    row.focusArea,
    row.name,
    row.equipment,
    row.metric,
    row.suggestedSets,
    row.suggestedReps,
    row.notes,
  ].join(" | ");
}

function goalSignature(row: GoalRow) {
  return [row.goal, row.metric, row.target, row.period, row.notes].join(" | ");
}
