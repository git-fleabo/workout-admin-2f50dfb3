import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calendar, Loader2, Plus, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  ONE_RM_EXERCISES,
  ONE_RM_FORMULAS,
  ONE_RM_SOURCES,
  ONE_RM_TYPES,
  add1RMTest,
  addBodyweight,
  get1RMRecent,
} from "@/lib/workout.functions";
import { Field, SimpleSelect } from "./-form-bits";

const today = () => new Date().toISOString().slice(0, 10);

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
  formula: "Brzycki",
});

type BwState = { date: string; bodyweight: string; notes: string };
const blankBw = (): BwState => ({ date: today(), bodyweight: "", notes: "" });

export function OneRMForm() {
  const qc = useQueryClient();
  const recentFn = useServerFn(get1RMRecent);
  const addFn = useServerFn(add1RMTest);
  const addBwFn = useServerFn(addBodyweight);

  const recent = useQuery({ queryKey: ["recent-1rm"], queryFn: () => recentFn() });

  const [form, setForm] = useState<TestState>(blankTest);
  const update = <K extends keyof TestState>(k: K, v: TestState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [bw, setBw] = useState<BwState>(blankBw);
  const updateBw = <K extends keyof BwState>(k: K, v: BwState[K]) =>
    setBw((f) => ({ ...f, [k]: v }));

  const mutate = useMutation({
    mutationFn: () => addFn({ data: form }),
    onSuccess: (res) => {
      toast.success(`Logged 1RM test to row ${res.row}`);
      setForm((f) => ({
        ...blankTest(),
        date: f.date,
        exercise: f.exercise,
        type: f.type,
        bodyweightUsed: f.bodyweightUsed,
        bwContribution: f.bwContribution,
        formula: f.formula,
      }));
      qc.invalidateQueries({ queryKey: ["recent-1rm"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bwMutate = useMutation({
    mutationFn: () => addBwFn({ data: bw }),
    onSuccess: (res) => {
      toast.success(`Logged bodyweight to row ${res.row}`);
      setBw(blankBw());
      qc.invalidateQueries({ queryKey: ["recent-1rm"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit =
    form.date && form.exercise && form.reps && form.formula && !mutate.isPending;
  const canSubmitBw = bw.date && bw.bodyweight && !bwMutate.isPending;

  return (
    <div className="space-y-6">
      <Card className="space-y-5 border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">New 1RM test</h2>
          <Badge variant="outline" className="gap-1 border-border text-muted-foreground">
            <Calendar className="h-3 w-3" /> {form.date}
          </Badge>
        </div>

        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <SimpleSelect
              value={form.type}
              onChange={(v) => update("type", v)}
              options={ONE_RM_TYPES}
            />
          </Field>
          <Field label="Formula">
            <SimpleSelect
              value={form.formula}
              onChange={(v) => update("formula", v)}
              options={ONE_RM_FORMULAS}
            />
          </Field>
        </div>

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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={bw.date} onChange={(e) => updateBw("date", e.target.value)} />
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
          {bwMutate.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Save bodyweight"
          )}
        </Button>
      </Card>

      <section className="space-y-3">
        <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recent tests
        </h2>
        {recent.isLoading && (
          <Card className="p-4 text-sm text-muted-foreground">Loading…</Card>
        )}
        {!recent.isLoading && (recent.data?.recent.length ?? 0) === 0 && (
          <Card className="p-4 text-sm text-muted-foreground">No tests logged yet.</Card>
        )}
        <div className="space-y-2">
          {recent.data?.recent.map((r, i) => (
            <Card key={i} className="flex items-start gap-3 border-border bg-card p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-mono text-muted-foreground">
                {r.date?.slice(5) || "—"}
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
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
