import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Calendar, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { addWorkout, getLibrary, getRecentLogs, REST_OPTIONS } from "@/lib/workout.functions";
import { Field, SimpleSelect, RecentList, type RecentEntry } from "./-form-bits";

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
  restTime: string;
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
  restTime: "",
  completed: true,
  notes: "",
});

export function WorkoutForm() {
  const qc = useQueryClient();
  const libFn = useServerFn(getLibrary);
  const recentFn = useServerFn(getRecentLogs);
  const addFn = useServerFn(addWorkout);

  const lib = useQuery({ queryKey: ["library"], queryFn: () => libFn() });
  const recent = useQuery({ queryKey: ["recent-workouts"], queryFn: () => recentFn() });

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

  const recentExerciseChips = useMemo(() => {
    const ex = lib.data?.exercises ?? [];
    const byName = new Map(ex.map((e) => [e.name, e]));
    const seen = new Set<string>();
    const chips: { name: string; workoutType: string; focusArea: string }[] = [];
    for (const r of recent.data?.recent ?? []) {
      const name = r.exercise?.trim();
      if (!name || seen.has(name)) continue;
      const meta = byName.get(name);
      if (form.workoutType && meta && meta.workoutType !== form.workoutType) continue;
      if (form.focusArea && meta && meta.focusArea !== form.focusArea) continue;
      seen.add(name);
      chips.push({
        name,
        workoutType: meta?.workoutType ?? r.workoutType ?? "",
        focusArea: meta?.focusArea ?? "",
      });
      if (chips.length >= 6) break;
    }
    if (chips.length < 6) {
      for (const e of exerciseOptions) {
        if (seen.has(e.name)) continue;
        seen.add(e.name);
        chips.push(e);
        if (chips.length >= 6) break;
      }
    }
    return chips;
  }, [recent.data, lib.data, exerciseOptions, form.workoutType, form.focusArea]);

  const mutate = useMutation({
    mutationFn: () => addFn({ data: form }),
    onSuccess: (res) => {
      toast.success(`Logged to row ${res.row}`);
      setForm((f) => ({
        ...blank(),
        date: f.date,
        workoutType: f.workoutType,
        focusArea: f.focusArea,
      }));
      qc.invalidateQueries({ queryKey: ["recent-workouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = form.date && form.exercise && !mutate.isPending;

  const recentEntries: RecentEntry[] =
    recent.data?.recent.map((r) => ({
      date: r.date,
      title: r.exercise,
      meta:
        [
          r.sets && r.reps ? `${r.sets}×${r.reps}` : r.sets || r.reps,
          r.weight,
          r.duration && `${r.duration}m`,
          r.rpe && `RPE ${r.rpe}`,
        ]
          .filter(Boolean)
          .join(" · ") || r.workoutType,
      completed: r.completed,
    })) ?? [];

  return (
    <div className="space-y-6">
      <Card className="space-y-5 border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">New workout</h2>
          <Badge variant="outline" className="gap-1 border-border text-muted-foreground">
            <Calendar className="h-3 w-3" /> {formatUKDate(form.date)}
          </Badge>
        </div>

        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <SimpleSelect
              value={form.workoutType}
              onChange={(v) => update("workoutType", v)}
              options={lib.data?.workoutTypes ?? []}
            />
          </Field>
          <Field label="Focus">
            <SimpleSelect
              value={form.focusArea}
              onChange={(v) => update("focusArea", v)}
              options={lib.data?.focusAreas ?? []}
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
            {recentExerciseChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {recentExerciseChips.map((e) => (
                  <button
                    key={e.name}
                    type="button"
                    onClick={() => {
                      update("exercise", e.name);
                      if (!form.workoutType && e.workoutType) update("workoutType", e.workoutType);
                      if (!form.focusArea && e.focusArea) update("focusArea", e.focusArea);
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
            />
          </Field>
          <Field label="RPE">
            <Input inputMode="decimal" value={form.rpe} onChange={(e) => update("rpe", e.target.value)} />
          </Field>
        </div>

        <Field label="Rest between sets">
          <SimpleSelect
            value={form.restTime}
            onChange={(v) => update("restTime", v)}
            options={REST_OPTIONS}
          />
        </Field>

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
          <Switch checked={form.completed} onCheckedChange={(v) => update("completed", v)} />
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

      <RecentList loading={recent.isLoading} entries={recentEntries} />
    </div>
  );
}
