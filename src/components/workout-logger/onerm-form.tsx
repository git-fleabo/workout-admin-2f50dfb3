import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, Loader2, Plus, Trash2, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  ONE_RM_EXERCISES,
  ONE_RM_DEFAULT_FORMULA,
  ONE_RM_SOURCES,
  ONE_RM_TYPES,
  add1RMTestClient,
  addBodyweightClient,
  delete1RMTestClient,
  deleteBodyweightClient,
  get1RMRecentClient,
} from "@/lib/supabase-log.browser";
import { formatUKDate, formatUKDateShort, todayISO } from "@/lib/date";
import {
  DateInput,
  DeleteConfirmDialog,
  Field,
  SimpleSelect,
  type DeleteTarget,
} from "./form-bits";

const today = todayISO;

type TestState = {
  date: string;
  source: string;
  exercise: string;
  type: string;
  bodyweightUsed: boolean;
  bwContribution: string;
  externalWeight: string;
  reps: string;
  rpe: string;
  formula: string;
};

const blankTest = (): TestState => ({
  date: today(),
  source: "Test",
  exercise: "Back Squat",
  type: "External Load",
  bodyweightUsed: false,
  bwContribution: "",
  externalWeight: "",
  reps: "",
  rpe: "",
  formula: ONE_RM_DEFAULT_FORMULA,
});

type BwState = { date: string; bodyweight: string; notes: string };
const blankBw = (): BwState => ({ date: today(), bodyweight: "", notes: "" });

export function OneRMForm() {
  const qc = useQueryClient();
  const recent = useQuery({ queryKey: ["recent-1rm"], queryFn: get1RMRecentClient });

  const [form, setForm] = useState<TestState>(blankTest);
  const update = <K extends keyof TestState>(k: K, v: TestState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [bw, setBw] = useState<BwState>(blankBw);
  const [deleteTarget, setDeleteTarget] = useState<
    (DeleteTarget & { kind: "test" | "bodyweight" }) | null
  >(null);
  const updateBw = <K extends keyof BwState>(k: K, v: BwState[K]) =>
    setBw((f) => ({ ...f, [k]: v }));

  const mutate = useMutation({
    mutationFn: () => add1RMTestClient(form),
    onSuccess: () => {
      toast.success("1RM test saved", {
        description: `${form.exercise} was added to your tests.`,
      });
      setForm((f) => ({
        ...blankTest(),
        date: f.date,
        exercise: f.exercise,
        type: f.type,
        bodyweightUsed: f.bodyweightUsed,
        bwContribution: f.bwContribution,
      }));
      qc.invalidateQueries({ queryKey: ["recent-1rm"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bwMutate = useMutation({
    mutationFn: () => addBodyweightClient(bw),
    onSuccess: () => {
      toast.success("Bodyweight saved", {
        description: `${bw.bodyweight}kg was added to your log.`,
      });
      setBw(blankBw());
      qc.invalidateQueries({ queryKey: ["recent-1rm"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTestMutation = useMutation({
    mutationFn: (id: string) => delete1RMTestClient(id),
    onSuccess: () => {
      toast.success("1RM test deleted");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["recent-1rm"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["prs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBwMutation = useMutation({
    mutationFn: (id: string) => deleteBodyweightClient(id),
    onSuccess: () => {
      toast.success("Bodyweight deleted");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["recent-1rm"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = form.date && form.exercise && form.reps && !mutate.isPending;
  const canSubmitBw = bw.date && bw.bodyweight && !bwMutate.isPending;

  return (
    <div className="space-y-6">
      <Card className="space-y-5 border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">New 1RM test</h2>
          <Badge variant="outline" className="gap-1 border-border text-muted-foreground">
            <Calendar className="h-3 w-3" /> {formatUKDate(form.date)}
          </Badge>
        </div>

        <Field label="Date">
          <DateInput value={form.date} onChange={(v) => update("date", v)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Exercise">
            <SimpleSelect
              value={form.exercise}
              onChange={(v) => update("exercise", v)}
              options={ONE_RM_EXERCISES}
            />
          </Field>
          <Field label="Source">
            <SimpleSelect
              value={form.source}
              onChange={(v) => update("source", v)}
              options={ONE_RM_SOURCES}
            />
          </Field>
        </div>

        <Field label="Type">
          <SimpleSelect
            value={form.type}
            onChange={(v) => update("type", v)}
            options={ONE_RM_TYPES}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="External weight">
            <Input
              inputMode="decimal"
              value={form.externalWeight}
              onChange={(e) => update("externalWeight", e.target.value)}
              placeholder="kg added"
            />
          </Field>
          <Field label="Reps">
            <Input
              inputMode="numeric"
              value={form.reps}
              onChange={(e) => update("reps", e.target.value)}
              placeholder="1–10"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="RPE">
            <Input
              inputMode="decimal"
              value={form.rpe}
              onChange={(e) => update("rpe", e.target.value)}
              placeholder="6–10"
            />
          </Field>
          <Field label="BW contribution %">
            <Input
              value={form.bwContribution}
              onChange={(e) => update("bwContribution", e.target.value)}
              placeholder="100% or 65%"
              disabled={!form.bodyweightUsed}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2">
          <Label className="text-sm">Bodyweight used</Label>
          <Switch
            checked={form.bodyweightUsed}
            onCheckedChange={(v) => update("bodyweightUsed", v)}
          />
        </div>

        <Button
          onClick={() => mutate.mutate()}
          disabled={!canSubmit}
          className="h-12 w-full text-base font-semibold"
          style={{ backgroundImage: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
        >
          {mutate.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Plus className="mr-1 h-5 w-5" /> Log test
            </>
          )}
        </Button>
      </Card>

      <Card className="space-y-4 border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Log bodyweight</h2>
          {recent.data?.latestBodyweight && (
            <Badge variant="outline" className="border-border text-muted-foreground">
              Latest: {recent.data.latestBodyweight}
            </Badge>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date">
            <DateInput value={bw.date} onChange={(v) => updateBw("date", v)} />
          </Field>
          <Field label="Bodyweight">
            <Input
              inputMode="decimal"
              value={bw.bodyweight}
              onChange={(e) => updateBw("bodyweight", e.target.value)}
              placeholder="kg"
            />
          </Field>
        </div>
        <Field label="Notes">
          <Input
            value={bw.notes}
            onChange={(e) => updateBw("notes", e.target.value)}
            placeholder="Optional"
          />
        </Field>
        <Button
          onClick={() => bwMutate.mutate()}
          disabled={!canSubmitBw}
          variant="secondary"
          className="h-11 w-full font-medium"
        >
          {bwMutate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save bodyweight"}
        </Button>
      </Card>

      {(recent.data?.bodyweight.length ?? 0) > 0 && (
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent bodyweight
          </h2>
          <div className="space-y-2">
            {recent.data?.bodyweight.map((r) => {
              const deleting = deleteBwMutation.variables === r.id;
              return (
                <Card key={r.id} className="flex items-start gap-3 border-border bg-card p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-mono text-muted-foreground">
                    {formatUKDateShort(r.date)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.bodyweight}kg</p>
                    {r.notes && <p className="truncate text-xs text-muted-foreground">{r.notes}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={deleting}
                    onClick={() => {
                      setDeleteTarget({
                        id: r.id,
                        kind: "bodyweight",
                        title: "Bodyweight",
                        description: `${r.bodyweight}kg from ${formatUKDate(r.date)} will be permanently removed from your log.`,
                      });
                    }}
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Delete bodyweight"
                    title="Delete"
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recent tests
        </h2>
        {recent.isLoading && <Card className="p-4 text-sm text-muted-foreground">Loading…</Card>}
        {!recent.isLoading && (recent.data?.recent.length ?? 0) === 0 && (
          <Card className="p-4 text-sm text-muted-foreground">No tests logged yet.</Card>
        )}
        <div className="space-y-2">
          {recent.data?.recent.map((r) => {
            const deleting = deleteTestMutation.variables === r.id;
            return (
              <Card key={r.id} className="flex items-start gap-3 border-border bg-card p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-mono text-muted-foreground">
                  {formatUKDateShort(r.date)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{r.exercise}</p>
                    {r.pr && (
                      <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="PR" />
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      r.externalWeight && `${r.externalWeight}kg`,
                      r.reps && `${r.reps} reps`,
                      r.rpe && `RPE ${r.rpe}`,
                      r.estTotal && `≈ ${r.estTotal} 1RM`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || r.source}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={deleting}
                  onClick={() => {
                    setDeleteTarget({
                      id: r.id,
                      kind: "test",
                      title: r.exercise,
                      description: `${r.exercise} test from ${formatUKDate(r.date)} will be permanently removed from your tests.`,
                    });
                  }}
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${r.exercise} test`}
                  title="Delete"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </Card>
            );
          })}
        </div>
      </section>
      <DeleteConfirmDialog
        target={deleteTarget}
        busy={deleteTestMutation.isPending || deleteBwMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={(id) => {
          if (deleteTarget?.kind === "bodyweight") {
            deleteBwMutation.mutate(id);
          } else {
            deleteTestMutation.mutate(id);
          }
        }}
      />
    </div>
  );
}
