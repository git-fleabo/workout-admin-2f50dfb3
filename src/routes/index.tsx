import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dumbbell, Loader2, Plus, Calendar, History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";

import {
  addWorkout,
  getLibrary,
  getRecentLogs,
} from "@/lib/workout.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Workout Logger" },
      { name: "description", content: "Mobile-first workout logger that writes straight to your training spreadsheet." },
    ],
  }),
  component: Index,
});

const today = () => new Date().toISOString().slice(0, 10);

type FormState = {
  date: string;
  workoutType: string;
  focusArea: string;
  exercise: string;
  sets: string;
  reps: string;
  weight: string;
  duration: string;
  intensity: string;
  rpe: string;
  completed: boolean;
  notes: string;
};

const blank = (): FormState => ({
  date: today(),
  workoutType: "",
  focusArea: "",
  exercise: "",
  sets: "",
  reps: "",
  weight: "",
  duration: "",
  intensity: "",
  rpe: "",
  completed: true,
  notes: "",
});

function Index() {
  const qc = useQueryClient();
  const libFn = useServerFn(getLibrary);
  const recentFn = useServerFn(getRecentLogs);
  const addFn = useServerFn(addWorkout);

  const lib = useQuery({ queryKey: ["library"], queryFn: () => libFn() });
  const recent = useQuery({ queryKey: ["recent"], queryFn: () => recentFn() });

  const [form, setForm] = useState<FormState>(blank);
  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const exerciseOptions = useMemo(() => {
    const ex = lib.data?.exercises ?? [];
    if (!form.workoutType && !form.focusArea) return ex;
    return ex.filter(
      (e) =>
        (!form.workoutType || e.workoutType === form.workoutType) &&
        (!form.focusArea || e.focusArea === form.focusArea),
    );
  }, [lib.data, form.workoutType, form.focusArea]);

  const mutate = useMutation({
    mutationFn: () => addFn({ data: form }),
    onSuccess: (res) => {
      toast.success(`Logged to row ${res.row}`);
      setForm((f) => ({ ...blank(), date: f.date, workoutType: f.workoutType, focusArea: f.focusArea }));
      qc.invalidateQueries({ queryKey: ["recent"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = form.date && form.exercise && !mutate.isPending;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-center" />
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-primary)" }}
          >
            <Dumbbell className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold leading-none">Workout Log</h1>
            <p className="text-xs text-muted-foreground">Streaming to your sheet</p>
          </div>
          {lib.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-6 px-4 pb-24 pt-6">
        <Card className="space-y-5 border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">New entry</h2>
            <Badge variant="outline" className="gap-1 border-border text-muted-foreground">
              <Calendar className="h-3 w-3" /> {form.date}
            </Badge>
          </div>

          <Field label="Date">
            <Input
              type="date"
              value={form.date}
              onChange={(e) => update("date", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <SimpleSelect
                value={form.workoutType}
                onChange={(v) => update("workoutType", v)}
                options={lib.data?.workoutTypes ?? []}
                placeholder="Any"
              />
            </Field>
            <Field label="Focus">
              <SimpleSelect
                value={form.focusArea}
                onChange={(v) => update("focusArea", v)}
                options={lib.data?.focusAreas ?? []}
                placeholder="Any"
              />
            </Field>
          </div>

          <Field label="Exercise">
            <div className="space-y-2">
              <Input
                value={form.exercise}
                onChange={(e) => update("exercise", e.target.value)}
                placeholder="e.g. Bench Press"
                list="exercise-list"
              />
              <datalist id="exercise-list">
                {exerciseOptions.map((e) => (
                  <option key={e.name} value={e.name} />
                ))}
              </datalist>
              {exerciseOptions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {exerciseOptions.slice(0, 6).map((e) => (
                    <button
                      key={e.name}
                      type="button"
                      onClick={() => {
                        update("exercise", e.name);
                        if (!form.workoutType) update("workoutType", e.workoutType);
                        if (!form.focusArea) update("focusArea", e.focusArea);
                      }}
                      className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-secondary-foreground transition hover:border-primary hover:text-primary"
                    >
                      {e.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Sets">
              <Input inputMode="numeric" value={form.sets} onChange={(e) => update("sets", e.target.value)} />
            </Field>
            <Field label="Reps">
              <Input value={form.reps} onChange={(e) => update("reps", e.target.value)} />
            </Field>
            <Field label="Weight">
              <Input inputMode="decimal" value={form.weight} onChange={(e) => update("weight", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Min">
              <Input inputMode="numeric" value={form.duration} onChange={(e) => update("duration", e.target.value)} />
            </Field>
            <Field label="Intensity">
              <SimpleSelect
                value={form.intensity}
                onChange={(v) => update("intensity", v)}
                options={lib.data?.intensities ?? []}
                placeholder="—"
              />
            </Field>
            <Field label="RPE">
              <Input inputMode="decimal" value={form.rpe} onChange={(e) => update("rpe", e.target.value)} />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Form cues, how it felt…"
            />
          </Field>

          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2">
            <Label className="text-sm">Completed</Label>
            <Switch
              checked={form.completed}
              onCheckedChange={(v) => update("completed", v)}
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
                <Plus className="mr-1 h-5 w-5" /> Log workout
              </>
            )}
          </Button>
        </Card>

        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent
            </h2>
          </div>
          {recent.isLoading && (
            <Card className="p-4 text-sm text-muted-foreground">Loading…</Card>
          )}
          {recent.data?.recent.length === 0 && (
            <Card className="p-4 text-sm text-muted-foreground">No entries yet.</Card>
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
                    {r.completed && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      r.sets && r.reps ? `${r.sets}×${r.reps}` : r.sets || r.reps,
                      r.weight && `${r.weight}`,
                      r.duration && `${r.duration}m`,
                      r.rpe && `RPE ${r.rpe}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || r.workoutType}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SimpleSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <Select value={value || "__none"} onValueChange={(v) => onChange(v === "__none" ? "" : v)}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">— Any —</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
