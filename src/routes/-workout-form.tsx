import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  addWorkoutClient,
  deleteSessionClient,
  getLibraryClient,
  getRecentLogsClient,
  REST_OPTIONS,
} from "@/lib/supabase-log.browser";
import { formatUKDate, todayISO } from "@/lib/date";
import { DateInput, Field, SimpleSelect, RecentList, type RecentEntry } from "./-form-bits";

const today = todayISO;
const SKILL_WORKOUT_TYPE = "Skills/Calisthenics";
const GRIP_WORKOUT_TYPE = "Grip";
const YOGA_WORKOUT_TYPE = "Yoga";
const GRIP_STYLES = [
  "Open hand",
  "Half crimp",
  "Full crimp",
  "Pinch",
  "Support",
  "Crush",
  "Wrist/forearm",
];
const GRIP_LOAD_TYPES = [
  "Bodyweight",
  "Added weight",
  "Assistance/counterweight",
  "Implement weight",
];
const FALLBACK_WORKOUT_TYPES = [
  "Strength",
  "Cardio",
  YOGA_WORKOUT_TYPE,
  "Stretching",
  "Mobility",
  "Sport",
  SKILL_WORKOUT_TYPE,
  GRIP_WORKOUT_TYPE,
  "Other",
];
const FALLBACK_MOVEMENTS = [
  { workoutType: "Strength", focusArea: "", name: "Bench Press" },
  { workoutType: "Strength", focusArea: "", name: "High Bar Squat" },
  { workoutType: "Strength", focusArea: "", name: "Kettlebell Clean" },
  { workoutType: YOGA_WORKOUT_TYPE, focusArea: "", name: "Yoga Flow" },
  { workoutType: "Stretching", focusArea: "", name: "Stretch Session" },
  { workoutType: SKILL_WORKOUT_TYPE, focusArea: "", name: "Front Lever" },
  { workoutType: SKILL_WORKOUT_TYPE, focusArea: "", name: "Ring Muscle-Up" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Hangboard" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Fat Grip Hang" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Pinch Block" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Farmer Carry" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Towel Hang" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Dead Hang" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Wrist Roller" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Rice Bucket" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Other" },
];

type FormState = {
  date: string;
  entryKind: string;
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
  progressionLevel: string;
  holdSeconds: string;
  assistanceType: string;
  assistanceDetail: string;
  quality: string;
  gripStyle: string;
  gripLoadType: string;
};

const blank = (defaultWorkoutType = ""): FormState => ({
  date: today(),
  entryKind: defaultWorkoutType === SKILL_WORKOUT_TYPE ? "Skill" : "",
  workoutType: defaultWorkoutType,
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
  progressionLevel: "",
  holdSeconds: "",
  assistanceType: "",
  assistanceDetail: "",
  quality: "",
  gripStyle: "",
  gripLoadType: "",
});

export function WorkoutForm({
  defaultWorkoutType = "",
  title = "New workout",
}: {
  defaultWorkoutType?: string;
  title?: string;
}) {
  const qc = useQueryClient();
  const lib = useQuery({ queryKey: ["library"], queryFn: getLibraryClient });
  const recent = useQuery({ queryKey: ["recent-workouts"], queryFn: getRecentLogsClient });

  const [form, setForm] = useState<FormState>(() => blank(defaultWorkoutType));
  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const libraryExercises =
    lib.data?.exercises && lib.data.exercises.length > 0
      ? lib.data.exercises
      : FALLBACK_MOVEMENTS;
  const workoutTypeOptions =
    lib.data?.workoutTypes && lib.data.workoutTypes.length > 0
      ? lib.data.workoutTypes
      : FALLBACK_WORKOUT_TYPES;

  const exerciseOptions = useMemo(() => {
    const ex = libraryExercises;
    if (!form.workoutType) return ex;
    return ex.filter(
      (e) => !form.workoutType || e.workoutType === form.workoutType,
    );
  }, [libraryExercises, form.workoutType]);

  const selectedExercise = useMemo(
    () =>
      libraryExercises.find(
        (e) => e.name.toLowerCase() === form.exercise.trim().toLowerCase(),
      ),
    [libraryExercises, form.exercise],
  );
  const isSkill =
    form.entryKind === "Skill" ||
    form.workoutType === SKILL_WORKOUT_TYPE ||
    selectedExercise?.workoutType === SKILL_WORKOUT_TYPE;
  const isGrip =
    form.entryKind === GRIP_WORKOUT_TYPE ||
    form.workoutType === GRIP_WORKOUT_TYPE ||
    selectedExercise?.workoutType === GRIP_WORKOUT_TYPE;
  const isYoga =
    form.workoutType === YOGA_WORKOUT_TYPE ||
    selectedExercise?.workoutType === YOGA_WORKOUT_TYPE;

  const mutate = useMutation({
    mutationFn: () =>
      addWorkoutClient({
        ...form,
        workoutType: selectedExercise?.workoutType ?? form.workoutType,
        focusArea: "",
        progressionLevel: isGrip ? form.gripStyle : form.progressionLevel,
        assistanceType: isGrip ? form.gripLoadType : form.assistanceType,
        entryKind: isYoga ? "Workout" : isGrip ? GRIP_WORKOUT_TYPE : isSkill ? "Skill" : form.entryKind || "Workout",
      }),
    onSuccess: (res) => {
      toast.success(`Logged to ${res.row}`);
        setForm((f) => ({
          ...blank(defaultWorkoutType),
          date: f.date,
          workoutType: defaultWorkoutType || f.workoutType,
          focusArea: "",
          entryKind: defaultWorkoutType === SKILL_WORKOUT_TYPE ? "Skill" : f.entryKind,
        }));
      qc.invalidateQueries({ queryKey: ["recent-workouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSessionClient(id),
    onSuccess: () => {
      toast.success("Workout deleted");
      qc.invalidateQueries({ queryKey: ["recent-workouts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["prs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = form.date && form.exercise && !mutate.isPending;

  const recentEntries: RecentEntry[] =
    recent.data?.recent.map((r) => ({
      id: r.id,
      date: r.date,
      title: r.exercise,
      meta:
        [
          r.entryKind === "Skill" && "Skill",
          r.entryKind === GRIP_WORKOUT_TYPE && GRIP_WORKOUT_TYPE,
          r.progressionLevel,
          r.holdSeconds && `${r.holdSeconds}s`,
          r.sets && r.reps ? `${r.sets}×${r.reps}` : r.sets || r.reps,
          r.weight,
          r.duration && `${r.duration}m`,
          r.rpe && `RPE ${r.rpe}`,
          r.quality,
        ]
          .filter(Boolean)
          .join(" · ") || r.workoutType,
      completed: r.completed,
    })) ?? [];

  return (
    <div className="space-y-6">
      <Card className="space-y-5 border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <Badge variant="outline" className="gap-1 border-border text-muted-foreground">
            <Calendar className="h-3 w-3" /> {formatUKDate(form.date)}
          </Badge>
        </div>

        <Field label="Date">
          <DateInput value={form.date} onChange={(v) => update("date", v)} />
        </Field>

        <Field label="Type">
          <SimpleSelect
            value={form.workoutType}
            onChange={(v) => {
              update("workoutType", v);
              update(
                "entryKind",
                v === SKILL_WORKOUT_TYPE ? "Skill" : v === GRIP_WORKOUT_TYPE ? GRIP_WORKOUT_TYPE : "Workout",
              );
              update("focusArea", "");
            }}
            options={workoutTypeOptions}
          />
        </Field>

        <Field label="Movement">
          <SimpleSelect
            value={form.exercise}
            onChange={(v) => update("exercise", v)}
            options={exerciseOptions.map((e) => e.name)}
            placeholder="e.g. Bench Press or Front Lever"
            noneLabel="Select"
          />
        </Field>

        {!isYoga && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Sets">
              <Input inputMode="numeric" value={form.sets} onChange={(e) => update("sets", e.target.value)} />
            </Field>
            <Field label="Reps">
              <Input inputMode="numeric" pattern="[0-9]*" value={form.reps} onChange={(e) => update("reps", e.target.value)} />
            </Field>
            <Field label={isGrip ? "Load" : "Weight"}>
              <Input inputMode="decimal" value={form.weight} onChange={(e) => update("weight", e.target.value)} />
            </Field>
          </div>
        )}

        {!isGrip && (
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
        )}

        {isGrip && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Grip style">
              <SimpleSelect
                value={form.gripStyle}
                onChange={(v) => update("gripStyle", v)}
                options={GRIP_STYLES}
              />
            </Field>
            <Field label="RPE">
              <Input inputMode="decimal" value={form.rpe} onChange={(e) => update("rpe", e.target.value)} />
            </Field>
          </div>
        )}

        {!isYoga && (
          <Field label="Rest between sets">
            <SimpleSelect
              value={form.restTime}
              onChange={(v) => update("restTime", v)}
              options={REST_OPTIONS}
            />
          </Field>
        )}

        {isYoga && (
          <Field label="Quality">
            <SimpleSelect
              value={form.quality}
              onChange={(v) => update("quality", v)}
              options={lib.data?.qualities ?? []}
            />
          </Field>
        )}

        {(isSkill || isGrip) && (
          <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
            {isSkill && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Progression">
                  <Input
                    value={form.progressionLevel}
                    onChange={(e) => update("progressionLevel", e.target.value)}
                    placeholder="Tuck, Full, V4…"
                  />
                </Field>
                <Field label="Quality">
                  <SimpleSelect
                    value={form.quality}
                    onChange={(v) => update("quality", v)}
                    options={lib.data?.qualities ?? []}
                  />
                </Field>
              </div>
            )}
            <div className={isGrip ? "grid grid-cols-2 gap-3" : ""}>
              <Field label="Hold seconds">
                <Input
                  inputMode="decimal"
                  value={form.holdSeconds}
                  onChange={(e) => update("holdSeconds", e.target.value)}
                />
              </Field>
              {isGrip && (
                <Field label="Quality">
                  <SimpleSelect
                    value={form.quality}
                    onChange={(v) => update("quality", v)}
                    options={lib.data?.qualities ?? []}
                  />
                </Field>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={isGrip ? "Load type" : "Assistance"}>
                <SimpleSelect
                  value={isGrip ? form.gripLoadType : form.assistanceType}
                  onChange={(v) => (isGrip ? update("gripLoadType", v) : update("assistanceType", v))}
                  options={isGrip ? GRIP_LOAD_TYPES : lib.data?.assistanceTypes ?? []}
                />
              </Field>
              <Field label="Detail">
                <Input
                  value={form.assistanceDetail}
                  onChange={(e) => update("assistanceDetail", e.target.value)}
                  placeholder={isGrip ? "20mm edge, +10kg…" : "Red band, 10kg…"}
                />
              </Field>
            </div>
          </div>
        )}

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

      <RecentList
        loading={recent.isLoading}
        entries={recentEntries}
        deletingId={deleteMutation.variables ?? null}
        onDelete={(entry) => {
          if (!entry.id) return;
          if (!window.confirm(`Delete ${entry.title} from ${formatUKDate(entry.date)}?`)) return;
          deleteMutation.mutate(entry.id);
        }}
        onSelect={(i) => {
          const r = recent.data?.recent[i];
          if (!r) return;
          const meta = (lib.data?.exercises ?? []).find((e) => e.name === r.exercise);
          setForm((f) => ({
            ...f,
            exercise: r.exercise ?? f.exercise,
            workoutType: meta?.workoutType ?? r.workoutType ?? f.workoutType,
            focusArea: meta?.focusArea ?? f.focusArea,
            entryKind:
              r.entryKind ||
              (meta?.workoutType === SKILL_WORKOUT_TYPE
                ? "Skill"
                : meta?.workoutType === GRIP_WORKOUT_TYPE
                  ? GRIP_WORKOUT_TYPE
                  : f.entryKind),
            sets: r.sets ?? f.sets,
            reps: r.reps ?? f.reps,
            weight: r.weight ?? f.weight,
            duration: r.duration ?? f.duration,
            rpe: r.rpe ?? f.rpe,
            progressionLevel: r.progressionLevel ?? f.progressionLevel,
            gripStyle: r.entryKind === GRIP_WORKOUT_TYPE ? r.progressionLevel ?? f.gripStyle : f.gripStyle,
            holdSeconds: r.holdSeconds ?? f.holdSeconds,
            assistanceType: r.assistanceType ?? f.assistanceType,
            gripLoadType: r.entryKind === GRIP_WORKOUT_TYPE ? r.assistanceType ?? f.gripLoadType : f.gripLoadType,
            assistanceDetail: r.assistanceDetail ?? f.assistanceDetail,
            quality: r.quality ?? f.quality,
          }));
          toast.message(`Prefilled from ${r.exercise}`);
        }}
      />
    </div>
  );
}
