import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar,
  Check,
  ChevronsUpDown,
  Copy,
  Dumbbell,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  addClimbClient,
  addWorkoutSessionClient,
  addWorkoutClient,
  BOARD_GRADIENTS,
  deleteSessionClient,
  findDuplicateLogClient,
  getLibraryClient,
  getRecentLogsClient,
  getTrainingLocationsClient,
  REST_OPTIONS,
} from "@/lib/supabase-log.browser";
import { formatUKDate, todayISO } from "@/lib/date";
import {
  completeSuggestedWorkoutClient,
  getNextSuggestedWorkoutsClient,
  updateSuggestedWorkoutStatusClient,
  type SavedWorkoutPlan,
} from "@/lib/supabase-plans.browser";
import { getSupabaseSession } from "@/lib/supabase-public";
import {
  getMovementMetricProfile,
  type MetricProfile,
  profileUsesLoad,
  profileUsesStandardSets,
} from "@/lib/movement-metrics";
import {
  readWorkoutPlanDraft,
  WORKOUT_PLAN_DRAFT_KEY,
  type RecentWorkoutLog,
  type WorkoutPlanDraft,
} from "@/lib/workout-plan";
import {
  DateInput,
  DeleteConfirmDialog,
  Field,
  SimpleSelect,
  RecentList,
  type DeleteTarget,
  type RecentEntry,
} from "./-form-bits";

const today = todayISO;
const SKILL_WORKOUT_TYPE = "Skills/Calisthenics";
const GRIP_WORKOUT_TYPE = "Grip";
const YOGA_WORKOUT_TYPE = "Yoga";
const CLIMBING_WORKOUT_TYPE = "Climbing";
const CLASS_WORKOUT_TYPE = "Class";
const MOBILITY_WORKOUT_TYPE = "Mobility/Flexibility";
const WORKOUT_SESSION_DRAFT_KEY_PREFIX = "workout-session-draft";
const CLIMBING_MOVEMENTS = ["Bouldering Session", "Ropes/Belay", "Kilter", "Mix"];
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
  CLIMBING_WORKOUT_TYPE,
  YOGA_WORKOUT_TYPE,
  MOBILITY_WORKOUT_TYPE,
  SKILL_WORKOUT_TYPE,
  GRIP_WORKOUT_TYPE,
  "Other",
];
const FALLBACK_MOVEMENTS: Array<{
  workoutType: string;
  focusArea: string;
  name: string;
  metric?: string;
  locationScope?: "home" | "gym" | "both";
}> = [
  { workoutType: "Strength", focusArea: "", name: "Bench Press" },
  { workoutType: "Strength", focusArea: "", name: "High Bar Squat" },
  { workoutType: "Strength", focusArea: "", name: "Kettlebell Clean" },
  { workoutType: YOGA_WORKOUT_TYPE, focusArea: "", name: "Yoga Flow" },
  { workoutType: MOBILITY_WORKOUT_TYPE, focusArea: "", name: "Stretch Session" },
  { workoutType: SKILL_WORKOUT_TYPE, focusArea: "", name: "Front Lever" },
  { workoutType: SKILL_WORKOUT_TYPE, focusArea: "", name: "Ring Muscle-Up" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Hangboard" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Fat Grip Hang" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Pinch Block" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Farmer Carry" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Towel Hang" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Dead Hang" },
  { workoutType: GRIP_WORKOUT_TYPE, focusArea: "", name: "Wrist Roller" },
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
  climbingHours: string;
  climbingBoulders: string;
  climbingMaxGrade: string;
  climbingGradient: string;
  distance: string;
  distanceUnit: string;
  rounds: string;
  feel: string;
  height: string;
  detail: string;
  setRows: WorkoutSetState[];
};

type WorkoutSetState = {
  reps: string;
  weight: string;
  rpe: string;
  completed: boolean;
};

type SessionFormState = {
  date: string;
  title: string;
  trainingLocationId: string;
  duration: string;
  intensity: string;
  rpe: string;
  completed: boolean;
  notes: string;
  entries: FormState[];
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
  climbingHours: "",
  climbingBoulders: "",
  climbingMaxGrade: "",
  climbingGradient: "",
  distance: "",
  distanceUnit: "cm",
  rounds: "",
  feel: "",
  height: "",
  detail: "",
  setRows: [],
});

const blankSet = (): WorkoutSetState => ({ reps: "", weight: "", rpe: "", completed: true });

const blankSessionEntry = () => ({ ...blank(), setRows: [blankSet()] });

const blankSession = (): SessionFormState => ({
  date: today(),
  title: "Workout",
  trainingLocationId: "",
  duration: "",
  intensity: "",
  rpe: "",
  completed: true,
  notes: "",
  entries: [blankSessionEntry()],
});

type StoredWorkoutSessionDraft = {
  version: 1;
  savedAt: string;
  form: SessionFormState;
  loadedSuggestionId: string | null;
};

function readWorkoutSessionDraft(value: string | null): StoredWorkoutSessionDraft | null {
  if (!value) return null;
  try {
    const draft = JSON.parse(value) as StoredWorkoutSessionDraft;
    if (
      draft.version !== 1 ||
      typeof draft.savedAt !== "string" ||
      Number.isNaN(Date.parse(draft.savedAt)) ||
      !draft.form ||
      typeof draft.form.date !== "string" ||
      typeof draft.form.title !== "string" ||
      typeof draft.form.trainingLocationId !== "string" ||
      !Array.isArray(draft.form.entries) ||
      draft.form.entries.length === 0 ||
      !draft.form.entries.every(
        (entry) =>
          entry &&
          typeof entry.exercise === "string" &&
          typeof entry.workoutType === "string" &&
          Array.isArray(entry.setRows),
      ) ||
      (draft.loadedSuggestionId != null && typeof draft.loadedSuggestionId !== "string")
    ) {
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function entryHasDraftContent(entry: FormState) {
  const stringFields: (keyof FormState)[] = [
    "exercise",
    "sets",
    "reps",
    "weight",
    "duration",
    "intensity",
    "rpe",
    "restTime",
    "notes",
    "progressionLevel",
    "holdSeconds",
    "assistanceType",
    "assistanceDetail",
    "quality",
    "gripStyle",
    "gripLoadType",
    "climbingHours",
    "climbingBoulders",
    "climbingMaxGrade",
    "climbingGradient",
    "distance",
    "rounds",
    "feel",
    "height",
    "detail",
  ];
  return (
    stringFields.some((key) => Boolean(entry[key])) ||
    !entry.completed ||
    entry.setRows.some((set) => set.reps || set.weight || set.rpe || !set.completed)
  );
}

function sessionHasDraftContent(form: SessionFormState) {
  return Boolean(
    form.title !== "Workout" ||
    form.duration ||
    form.intensity ||
    form.rpe ||
    form.notes ||
    !form.completed ||
    form.entries.some(entryHasDraftContent),
  );
}

function workoutSessionDraftKey() {
  const userId = getSupabaseSession()?.user.id;
  return `${WORKOUT_SESSION_DRAFT_KEY_PREFIX}:${userId ?? "signed-out"}`;
}

function setRowsFromRecentLog(log: RecentWorkoutLog): WorkoutSetState[] {
  if (log.setRows.length > 1) return log.setRows.map((set) => ({ ...set }));
  const count = Math.max(1, Number(log.sets) || 1);
  const totalReps = Number(log.reps) || 0;
  const reps = totalReps ? Math.ceil(totalReps / count).toString() : (log.setRows[0]?.reps ?? "");
  return Array.from({ length: count }, () => ({
    reps,
    weight: log.weight,
    rpe: "",
    completed: true,
  }));
}

function setSummary(set: WorkoutSetState, usesLoad: boolean) {
  const load = usesLoad && set.weight ? `${set.weight} kg` : "";
  const reps = set.reps ? `${set.reps} reps` : "";
  const rpe = set.rpe ? `RPE ${set.rpe}` : "";
  return [load, reps, rpe].filter(Boolean).join(" · ") || "No values recorded";
}

function recentSetRepSummary(sets: string, reps: string) {
  return [
    sets ? `${sets} ${sets === "1" ? "set" : "sets"}` : "",
    reps ? `${reps} total ${reps === "1" ? "rep" : "reps"}` : "",
  ];
}

export function WorkoutForm({
  defaultWorkoutType = "",
  title = "New workout",
}: {
  defaultWorkoutType?: string;
  title?: string;
}) {
  const qc = useQueryClient();
  const lib = useQuery({ queryKey: ["library"], queryFn: getLibraryClient });
  const recent = useQuery({
    queryKey: ["recent-workouts"],
    queryFn: () => getRecentLogsClient(),
  });

  const [form, setForm] = useState<FormState>(() => blank(defaultWorkoutType));
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const libraryExercises =
    lib.data?.exercises && lib.data.exercises.length > 0 ? lib.data.exercises : FALLBACK_MOVEMENTS;
  const workoutTypeOptions =
    lib.data?.workoutTypes && lib.data.workoutTypes.length > 0
      ? Array.from(
          new Set([
            ...lib.data.workoutTypes.filter((type) => type !== "Bouldering" && type !== "Sport"),
            CLIMBING_WORKOUT_TYPE,
          ]),
        )
      : FALLBACK_WORKOUT_TYPES;

  const exerciseOptions = useMemo(() => {
    if (form.workoutType === CLIMBING_WORKOUT_TYPE) {
      return CLIMBING_MOVEMENTS.map((name) => ({
        workoutType: CLIMBING_WORKOUT_TYPE,
        focusArea: "",
        name,
      }));
    }
    const ex = libraryExercises;
    if (!form.workoutType) return ex;
    return ex.filter((e) => !form.workoutType || e.workoutType === form.workoutType);
  }, [libraryExercises, form.workoutType]);

  const selectedExercise = useMemo(
    () => libraryExercises.find((e) => e.name.toLowerCase() === form.exercise.trim().toLowerCase()),
    [libraryExercises, form.exercise],
  );
  const selectedExerciseMeta =
    selectedExercise ??
    exerciseOptions.find((e) => e.name.toLowerCase() === form.exercise.trim().toLowerCase());
  const metricProfile = getMovementMetricProfile({
    workoutType: selectedExerciseMeta?.workoutType ?? form.workoutType,
    movement: form.exercise,
    defaultMetric: selectedExercise?.metric,
  });
  const isSkill =
    form.entryKind === "Skill" ||
    form.workoutType === SKILL_WORKOUT_TYPE ||
    selectedExercise?.workoutType === SKILL_WORKOUT_TYPE;
  const isGrip =
    form.entryKind === GRIP_WORKOUT_TYPE ||
    form.workoutType === GRIP_WORKOUT_TYPE ||
    selectedExercise?.workoutType === GRIP_WORKOUT_TYPE;
  const isYoga =
    form.workoutType === YOGA_WORKOUT_TYPE || selectedExercise?.workoutType === YOGA_WORKOUT_TYPE;
  const isClimbing = form.workoutType === CLIMBING_WORKOUT_TYPE;
  const isClass =
    form.workoutType === CLASS_WORKOUT_TYPE || selectedExercise?.workoutType === CLASS_WORKOUT_TYPE;
  const isKilter = form.exercise === "Kilter";
  const usesStandardSets = profileUsesStandardSets(metricProfile);
  const usesLoad = profileUsesLoad(metricProfile);

  const mutate = useMutation({
    mutationFn: () => {
      if (isClimbing) {
        return addClimbClient({
          date: form.date,
          type: CLIMBING_WORKOUT_TYPE,
          movement: form.exercise,
          trackingMode: form.climbingBoulders ? "Boulders/Routes" : "Hours",
          hours: form.climbingHours,
          boulders: form.climbingBoulders,
          grade: form.climbingMaxGrade,
          gradient: isKilter ? form.climbingGradient : "",
          intensity: form.intensity,
          rpe: form.rpe,
          completed: form.completed,
          notes: form.notes,
        });
      }
      return addWorkoutClient({
        ...form,
        workoutType: selectedExercise?.workoutType ?? form.workoutType,
        focusArea: "",
        progressionLevel: isGrip ? form.gripStyle : form.progressionLevel,
        assistanceType: isGrip ? form.gripLoadType : form.assistanceType,
        entryKind:
          isYoga || metricProfile === "time" || metricProfile === "conditioning"
            ? "Workout"
            : isGrip
              ? GRIP_WORKOUT_TYPE
              : isSkill
                ? "Skill"
                : form.entryKind || "Workout",
      });
    },
    onSuccess: () => {
      toast.success(isClimbing ? "Climb saved" : "Workout saved", {
        description: `${form.exercise} was added to your log.`,
      });
      setForm(blank(defaultWorkoutType));
      setDuplicateOpen(false);
      qc.invalidateQueries({ queryKey: ["recent-workouts"] });
      qc.invalidateQueries({ queryKey: ["recent-climbs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSessionClient(id),
    onSuccess: () => {
      toast.success("Workout deleted");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["recent-workouts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["prs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit =
    form.date &&
    form.exercise &&
    (!isClimbing || Boolean(form.climbingHours || form.climbingBoulders)) &&
    !mutate.isPending;

  const submit = async (skipDuplicateCheck = false) => {
    if (!canSubmit || checkingDuplicate) return;
    if (!skipDuplicateCheck) {
      setCheckingDuplicate(true);
      try {
        const duplicate = await findDuplicateLogClient({
          date: form.date,
          title: form.exercise,
          sourceSheet: isClimbing ? "Climbing Log" : "Workout Log",
        });
        if (duplicate) {
          setDuplicateOpen(true);
          return;
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not check for duplicates.");
        return;
      } finally {
        setCheckingDuplicate(false);
      }
    }
    mutate.mutate();
  };

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
          ...recentSetRepSummary(r.sets, r.reps),
          r.weight && `${r.weight} kg`,
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
                v === SKILL_WORKOUT_TYPE
                  ? "Skill"
                  : v === GRIP_WORKOUT_TYPE
                    ? GRIP_WORKOUT_TYPE
                    : v === CLIMBING_WORKOUT_TYPE
                      ? "Climbing"
                      : "Workout",
              );
              if (v === CLIMBING_WORKOUT_TYPE) update("exercise", "");
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

        {isClimbing && (
          <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hours">
                <Input
                  inputMode="decimal"
                  value={form.climbingHours}
                  onChange={(e) => update("climbingHours", e.target.value)}
                  placeholder="e.g. 1.5"
                />
              </Field>
              <Field label="Boulders/Routes">
                <Input
                  inputMode="numeric"
                  value={form.climbingBoulders}
                  onChange={(e) => update("climbingBoulders", e.target.value)}
                />
              </Field>
            </div>
            <div className={isKilter ? "grid grid-cols-2 gap-3" : "grid gap-3"}>
              <Field label="Max grade">
                <Input
                  value={form.climbingMaxGrade}
                  onChange={(e) => update("climbingMaxGrade", e.target.value)}
                  placeholder="V4, 6a..."
                />
              </Field>
              {isKilter && (
                <Field label="Gradient">
                  <SimpleSelect
                    value={form.climbingGradient}
                    onChange={(v) => update("climbingGradient", v)}
                    options={BOARD_GRADIENTS}
                  />
                </Field>
              )}
            </div>
            <IntensityRow form={form} update={update} intensities={lib.data?.intensities ?? []} />
          </div>
        )}

        {!isClimbing && (
          <MetricFields
            profile={metricProfile}
            form={form}
            update={update}
            intensities={lib.data?.intensities ?? []}
            qualities={lib.data?.qualities ?? []}
            assistanceTypes={lib.data?.assistanceTypes ?? []}
            usesLoad={usesLoad}
            usesStandardSets={usesStandardSets}
            isGrip={isGrip}
            showIntensity={isClass}
          />
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
          onClick={() => submit()}
          disabled={!canSubmit || checkingDuplicate}
          className="h-12 w-full text-base font-semibold"
          style={{ backgroundImage: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
        >
          {mutate.isPending || checkingDuplicate ? (
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
          setDeleteTarget({
            id: entry.id,
            title: entry.title,
            description: `${entry.title} from ${formatUKDate(entry.date)} will be permanently removed from your log.`,
          });
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
            gripStyle:
              r.entryKind === GRIP_WORKOUT_TYPE ? (r.progressionLevel ?? f.gripStyle) : f.gripStyle,
            holdSeconds: r.holdSeconds ?? f.holdSeconds,
            assistanceType: r.assistanceType ?? f.assistanceType,
            gripLoadType:
              r.entryKind === GRIP_WORKOUT_TYPE
                ? (r.assistanceType ?? f.gripLoadType)
                : f.gripLoadType,
            assistanceDetail: r.assistanceDetail ?? f.assistanceDetail,
            quality: r.quality ?? f.quality,
          }));
          toast.message(`Prefilled from ${r.exercise}`);
        }}
      />
      <DeleteConfirmDialog
        target={deleteTarget}
        busy={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={(id) => deleteMutation.mutate(id)}
      />
      <AlertDialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Already logged today</AlertDialogTitle>
            <AlertDialogDescription>
              {form.exercise} already has an entry on {formatUKDate(form.date)}. Save another one
              anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => submit(true)}>Save anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function FullWorkoutForm() {
  const qc = useQueryClient();
  const draftStorageKey = useMemo(workoutSessionDraftKey, []);
  const lib = useQuery({ queryKey: ["library"], queryFn: getLibraryClient });
  const recent = useQuery({
    queryKey: ["recent-workouts", 100],
    queryFn: () => getRecentLogsClient(100),
  });
  const locations = useQuery({
    queryKey: ["training-locations"],
    queryFn: getTrainingLocationsClient,
  });
  const nextPlans = useQuery({
    queryKey: ["next-suggested-workouts"],
    queryFn: getNextSuggestedWorkoutsClient,
  });
  const [form, setForm] = useState<SessionFormState>(() => blankSession());
  const [initialFormLoaded, setInitialFormLoaded] = useState(false);
  const [loadedSuggestionId, setLoadedSuggestionId] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [discardDraftOpen, setDiscardDraftOpen] = useState(false);
  const allLibraryExercises =
    lib.data?.exercises && lib.data.exercises.length > 0 ? lib.data.exercises : FALLBACK_MOVEMENTS;
  const selectedLocationKind = locations.data?.find(
    (location) => location.id === form.trainingLocationId,
  )?.kind;
  const libraryExercises = useMemo(
    () =>
      selectedLocationKind === "home" || selectedLocationKind === "gym"
        ? allLibraryExercises.filter(
            (exercise) =>
              !("locationScope" in exercise) ||
              exercise.locationScope === "both" ||
              exercise.locationScope === selectedLocationKind,
          )
        : allLibraryExercises,
    [allLibraryExercises, selectedLocationKind],
  );

  const loadPlanIntoForm = useCallback(
    (draft: WorkoutPlanDraft) => {
      const trainingLocation = locations.data?.find(
        (location) => location.kind === draft.locationKind,
      );
      setForm({
        ...blankSession(),
        title: draft.title,
        trainingLocationId: trainingLocation?.id ?? "",
        entries: draft.movements.map((movement) => ({
          ...blankSessionEntry(),
          exercise: movement.exercise,
          workoutType: movement.workoutType,
          setRows: movement.setRows.map((set) => ({ ...set, completed: true })),
        })),
      });
      setLoadedSuggestionId(draft.suggestedWorkoutId ?? null);
    },
    [locations.data],
  );

  useEffect(() => {
    if (initialFormLoaded) return;
    const stored = window.localStorage.getItem(WORKOUT_PLAN_DRAFT_KEY);
    const planDraft = readWorkoutPlanDraft(stored);
    if (planDraft) {
      if (!locations.data?.length) return;
      loadPlanIntoForm(planDraft);
      window.localStorage.removeItem(WORKOUT_PLAN_DRAFT_KEY);
      window.localStorage.removeItem(draftStorageKey);
      setDraftSavedAt(null);
      setInitialFormLoaded(true);
      toast.message("Workout plan loaded", {
        description: "Review the suggestion, adjust anything you like, then save as normal.",
      });
      return;
    }

    const storedSessionDraft = window.localStorage.getItem(draftStorageKey);
    const sessionDraft = readWorkoutSessionDraft(storedSessionDraft);
    if (sessionDraft) {
      setForm(sessionDraft.form);
      setLoadedSuggestionId(sessionDraft.loadedSuggestionId);
      setDraftSavedAt(sessionDraft.savedAt);
      toast.message("Workout draft restored", {
        description: "Your unfinished workout is ready to continue.",
      });
    } else if (storedSessionDraft) {
      window.localStorage.removeItem(draftStorageKey);
    }
    setInitialFormLoaded(true);
  }, [draftStorageKey, initialFormLoaded, loadPlanIntoForm, locations.data]);

  useEffect(() => {
    if (!initialFormLoaded) return;
    if (!sessionHasDraftContent(form)) {
      window.localStorage.removeItem(draftStorageKey);
      setDraftSavedAt(null);
      return;
    }
    const savedAt = new Date().toISOString();
    const draft: StoredWorkoutSessionDraft = {
      version: 1,
      savedAt,
      form,
      loadedSuggestionId,
    };
    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    setDraftSavedAt(savedAt);
  }, [draftStorageKey, form, initialFormLoaded, loadedSuggestionId]);

  const useSavedPlan = useMutation({
    mutationFn: async (plan: SavedWorkoutPlan) => {
      await updateSuggestedWorkoutStatusClient(plan.suggestedWorkoutId, "accepted");
      return plan;
    },
    onSuccess: (plan) => {
      loadPlanIntoForm(plan);
      qc.invalidateQueries({ queryKey: ["next-suggested-workouts"] });
      toast.message("Workout plan loaded", {
        description: "Review the targets, adjust anything you like, then save as normal.",
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const skipSavedPlan = useMutation({
    mutationFn: (id: string) => updateSuggestedWorkoutStatusClient(id, "skipped"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["next-suggested-workouts"] });
      toast.message("Workout plan skipped");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!initialFormLoaded) return;
    if (form.trainingLocationId || !locations.data?.length) return;
    const remembered = window.localStorage.getItem("training-location-id");
    const selected =
      locations.data.find((location) => location.id === remembered) ?? locations.data[0];
    if (selected) {
      setForm((current) => ({ ...current, trainingLocationId: selected.id }));
    }
  }, [form.trainingLocationId, initialFormLoaded, locations.data]);

  const discardDraft = () => {
    window.localStorage.removeItem(draftStorageKey);
    setForm(blankSession());
    setLoadedSuggestionId(null);
    setDraftSavedAt(null);
    setDiscardDraftOpen(false);
    toast.message("Workout draft discarded");
  };

  const update = <K extends keyof SessionFormState>(k: K, v: SessionFormState[K]) =>
    setForm((current) => ({ ...current, [k]: v }));
  const updateEntry = <K extends keyof FormState>(index: number, key: K, value: FormState[K]) =>
    setForm((current) => ({
      ...current,
      entries: current.entries.map((entry, i) =>
        i === index ? { ...entry, [key]: value } : entry,
      ),
    }));
  const addEntry = () =>
    setForm((current) => ({
      ...current,
      entries: [...current.entries, blankSessionEntry()],
    }));
  const removeEntry = (index: number) =>
    setForm((current) => ({
      ...current,
      entries:
        current.entries.length === 1
          ? current.entries
          : current.entries.filter((_, i) => i !== index),
    }));
  const updateSet = <K extends keyof WorkoutSetState>(
    entryIndex: number,
    setIndex: number,
    key: K,
    value: WorkoutSetState[K],
  ) =>
    setForm((current) => ({
      ...current,
      entries: current.entries.map((entry, i) =>
        i === entryIndex
          ? {
              ...entry,
              setRows: entry.setRows.map((set, j) =>
                j === setIndex ? { ...set, [key]: value } : set,
              ),
            }
          : entry,
      ),
    }));
  const repeatLastSet = (entryIndex: number) =>
    setForm((current) => ({
      ...current,
      entries: current.entries.map((entry, i) => {
        if (i !== entryIndex) return entry;
        const previous = entry.setRows[entry.setRows.length - 1] ?? blankSet();
        return {
          ...entry,
          setRows: [...entry.setRows, { ...previous, rpe: "", completed: true }],
        };
      }),
    }));
  const addBlankSet = (entryIndex: number) =>
    setForm((current) => ({
      ...current,
      entries: current.entries.map((entry, i) =>
        i === entryIndex ? { ...entry, setRows: [...entry.setRows, blankSet()] } : entry,
      ),
    }));
  const removeSet = (entryIndex: number, setIndex: number) =>
    setForm((current) => ({
      ...current,
      entries: current.entries.map((entry, i) =>
        i === entryIndex
          ? {
              ...entry,
              setRows:
                entry.setRows.length === 1
                  ? entry.setRows
                  : entry.setRows.filter((_, j) => j !== setIndex),
            }
          : entry,
      ),
    }));

  const previousWorkoutFor = (exerciseName: string) => {
    if (!exerciseName) return undefined;
    const matches = recent.data?.recent.filter(
      (item) => item.completed && item.exercise.toLowerCase() === exerciseName.trim().toLowerCase(),
    );
    return (
      matches?.find((item) => item.trainingLocation?.kind === selectedLocationKind) ?? matches?.[0]
    );
  };

  const copyPreviousWorkout = (entryIndex: number, exerciseName: string) => {
    const previous = previousWorkoutFor(exerciseName);
    if (!previous) return;
    updateEntry(entryIndex, "setRows", setRowsFromRecentLog(previous));
    toast.message("Previous workout copied", {
      description: `${exerciseName} targets now match ${formatUKDate(previous.date)}.`,
    });
  };

  const mutate = useMutation({
    mutationFn: () =>
      addWorkoutSessionClient({
        date: form.date,
        title: form.title,
        trainingLocationId: form.trainingLocationId,
        duration: form.duration,
        intensity: form.intensity,
        rpe: form.rpe,
        completed: form.completed,
        notes: form.notes,
        entries: form.entries.map((entry) => {
          const selected = libraryExercises.find(
            (exercise) => exercise.name.toLowerCase() === entry.exercise.trim().toLowerCase(),
          );
          const profile = getMovementMetricProfile({
            workoutType: selected?.workoutType ?? entry.workoutType,
            movement: entry.exercise,
            defaultMetric: selected?.metric,
          });
          const isSkill =
            entry.workoutType === SKILL_WORKOUT_TYPE ||
            selected?.workoutType === SKILL_WORKOUT_TYPE;
          const isGrip =
            entry.workoutType === GRIP_WORKOUT_TYPE || selected?.workoutType === GRIP_WORKOUT_TYPE;
          const isYoga =
            entry.workoutType === YOGA_WORKOUT_TYPE || selected?.workoutType === YOGA_WORKOUT_TYPE;

          return {
            ...entry,
            date: form.date,
            workoutType: selected?.workoutType ?? entry.workoutType,
            focusArea: "",
            completed: form.completed,
            progressionLevel: isGrip ? entry.gripStyle : entry.progressionLevel,
            assistanceType: isGrip ? entry.gripLoadType : entry.assistanceType,
            entryKind:
              isYoga || profile === "time" || profile === "conditioning"
                ? "Workout"
                : isGrip
                  ? GRIP_WORKOUT_TYPE
                  : isSkill
                    ? "Skill"
                    : entry.entryKind || "Workout",
          };
        }),
      }),
    onSuccess: async (result) => {
      window.localStorage.removeItem(draftStorageKey);
      if (loadedSuggestionId) {
        try {
          await completeSuggestedWorkoutClient(loadedSuggestionId, result.sessionId);
          qc.invalidateQueries({ queryKey: ["next-suggested-workouts"] });
        } catch {
          toast.warning("Workout saved, but the plan could not be marked complete.");
        }
      }
      toast.success("Workout session saved", {
        description: `${form.entries.filter((entry) => entry.exercise).length} movements were added.`,
      });
      setForm(blankSession());
      setLoadedSuggestionId(null);
      qc.invalidateQueries({ queryKey: ["recent-workouts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["prs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit =
    form.date &&
    form.trainingLocationId &&
    form.entries.some((entry) => entry.exercise.trim()) &&
    !mutate.isPending;
  const hasDraftContent = sessionHasDraftContent(form);
  const draftTime = draftSavedAt
    ? new Date(draftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="space-y-6">
      {!loadedSuggestionId && (nextPlans.data?.length ?? 0) > 0 ? (
        <section className="space-y-2">
          <div>
            <h2 className="text-base font-semibold">Next workout</h2>
            <p className="text-xs text-muted-foreground">
              Saved plans stay here until you use or skip them.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {nextPlans.data?.map((plan) => (
              <Card
                key={plan.suggestedWorkoutId}
                className="border-cyan-400/25 bg-cyan-400/[0.05] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{plan.title}</p>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {plan.locationKind}
                      </Badge>
                      {plan.readiness ? (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {plan.readiness}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plan.movements.length} movements ·{" "}
                      {plan.movements.map((item) => item.exercise).join(", ")}
                    </p>
                  </div>
                  <Dumbbell className="h-5 w-5 shrink-0 text-cyan-300" />
                </div>
                <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                  <Button
                    type="button"
                    onClick={() => useSavedPlan.mutate(plan)}
                    disabled={useSavedPlan.isPending || skipSavedPlan.isPending}
                  >
                    {useSavedPlan.isPending &&
                    useSavedPlan.variables?.suggestedWorkoutId === plan.suggestedWorkoutId ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Load workout
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => skipSavedPlan.mutate(plan.suggestedWorkoutId)}
                    disabled={useSavedPlan.isPending || skipSavedPlan.isPending}
                  >
                    Skip
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <Card className="space-y-4 border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Your workout</h2>
            <p className="text-xs text-muted-foreground">
              Choose where, then log one movement or add the whole session.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="outline" className="gap-1 border-border text-muted-foreground">
              <Calendar className="h-3 w-3" /> {formatUKDate(form.date)}
            </Badge>
            {hasDraftContent ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">
                  {draftTime ? `Draft saved ${draftTime}` : "Saving draft…"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px] text-muted-foreground"
                  onClick={() => setDiscardDraftOpen(true)}
                >
                  Discard
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <Field label="Where are you training?">
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {(locations.data ?? []).map((location) => (
              <Button
                key={location.id}
                type="button"
                variant={form.trainingLocationId === location.id ? "secondary" : "outline"}
                className="sm:min-w-28"
                onClick={() => {
                  update("trainingLocationId", location.id);
                  window.localStorage.setItem("training-location-id", location.id);
                }}
              >
                {location.name}
              </Button>
            ))}
          </div>
        </Field>

        <details className="rounded-lg border border-border bg-secondary/20 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            Session details (optional)
          </summary>
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date">
                <DateInput value={form.date} onChange={(v) => update("date", v)} />
              </Field>
              <Field label="Session name">
                <Input value={form.title} onChange={(e) => update("title", e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Minutes">
                <Input
                  inputMode="numeric"
                  value={form.duration}
                  onChange={(e) => update("duration", e.target.value)}
                />
              </Field>
              <Field label="Intensity">
                <SimpleSelect
                  value={form.intensity}
                  onChange={(v) => update("intensity", v)}
                  options={lib.data?.intensities ?? []}
                />
              </Field>
              <Field label="Overall RPE">
                <Input
                  inputMode="decimal"
                  value={form.rpe}
                  onChange={(e) => update("rpe", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Session notes">
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Overall workout notes..."
              />
            </Field>
          </div>
        </details>
      </Card>

      <div className="space-y-3">
        {form.entries.map((entry, index) => {
          const selectedExercise = libraryExercises.find(
            (exercise) => exercise.name.toLowerCase() === entry.exercise.trim().toLowerCase(),
          );
          const profile = getMovementMetricProfile({
            workoutType: selectedExercise?.workoutType ?? entry.workoutType,
            movement: entry.exercise,
            defaultMetric: selectedExercise?.metric,
          });
          const isGrip =
            entry.entryKind === GRIP_WORKOUT_TYPE ||
            entry.workoutType === GRIP_WORKOUT_TYPE ||
            selectedExercise?.workoutType === GRIP_WORKOUT_TYPE;
          const previousWorkout = previousWorkoutFor(entry.exercise);
          const previousSets = previousWorkout ? setRowsFromRecentLog(previousWorkout) : [];

          return (
            <Card key={index} className="space-y-4 border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Movement {index + 1}</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEntry(index)}
                  disabled={form.entries.length === 1}
                >
                  Remove
                </Button>
              </div>
              <Field label="Movement">
                <MovementPicker
                  value={entry.exercise}
                  exercises={libraryExercises}
                  onChange={(name) => {
                    const selected = libraryExercises.find((exercise) => exercise.name === name);
                    updateEntry(index, "exercise", name);
                    updateEntry(index, "workoutType", selected?.workoutType ?? "Other");
                    updateEntry(
                      index,
                      "entryKind",
                      selected?.workoutType === SKILL_WORKOUT_TYPE
                        ? "Skill"
                        : selected?.workoutType === GRIP_WORKOUT_TYPE
                          ? GRIP_WORKOUT_TYPE
                          : "Workout",
                    );
                    updateEntry(index, "setRows", [blankSet()]);
                  }}
                />
              </Field>
              {entry.workoutType && (
                <Badge
                  variant="outline"
                  className="w-fit text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {entry.workoutType}
                </Badge>
              )}
              {entry.exercise && profileUsesStandardSets(profile) ? (
                <SetRowsEditor
                  rows={entry.setRows}
                  usesLoad={profileUsesLoad(profile)}
                  previousWorkout={
                    previousWorkout
                      ? {
                          date: previousWorkout.date,
                          location:
                            previousWorkout.trainingLocation?.name ??
                            previousWorkout.trainingLocation?.kind,
                          rows: previousSets,
                        }
                      : undefined
                  }
                  onChange={(setIndex, key, value) => updateSet(index, setIndex, key, value)}
                  onCopyPrevious={() => copyPreviousWorkout(index, entry.exercise)}
                  onRepeat={() => repeatLastSet(index)}
                  onAddBlank={() => addBlankSet(index)}
                  onRemove={(setIndex) => removeSet(index, setIndex)}
                />
              ) : (
                entry.exercise && (
                  <MetricFields
                    profile={profile}
                    form={entry}
                    update={(key, value) => updateEntry(index, key, value)}
                    intensities={lib.data?.intensities ?? []}
                    qualities={lib.data?.qualities ?? []}
                    assistanceTypes={lib.data?.assistanceTypes ?? []}
                    usesLoad={profileUsesLoad(profile)}
                    usesStandardSets={profileUsesStandardSets(profile)}
                    isGrip={isGrip}
                    showIntensity={entry.workoutType === CLASS_WORKOUT_TYPE}
                  />
                )
              )}
              <details className="rounded-lg border border-border/70 bg-secondary/10 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  Movement notes {entry.notes ? "· Added" : "· Optional"}
                </summary>
                <Textarea
                  rows={2}
                  className="mt-2"
                  value={entry.notes}
                  onChange={(e) => updateEntry(index, "notes", e.target.value)}
                  placeholder="Movement-specific notes..."
                />
              </details>
            </Card>
          );
        })}
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={addEntry}>
        <Plus className="mr-1 h-4 w-4" /> Add movement
      </Button>

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
            <Plus className="mr-1 h-5 w-5" /> Save workout
          </>
        )}
      </Button>

      <AlertDialog open={discardDraftOpen} onOpenChange={setDiscardDraftOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this workout draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Your unsaved movements, sets, and session details will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep draft</AlertDialogCancel>
            <AlertDialogAction onClick={discardDraft}>Discard draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MovementPicker({
  value,
  exercises,
  onChange,
}: {
  value: string;
  exercises: { name: string; workoutType: string; equipment?: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={value ? "truncate" : "truncate text-muted-foreground"}>
            {value || "Search movements"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,420px)] p-0">
        <Command>
          <CommandInput placeholder="Search by movement or type..." />
          <CommandList>
            <CommandEmpty>No movement found.</CommandEmpty>
            <CommandGroup>
              {exercises.map((exercise) => (
                <CommandItem
                  key={exercise.name}
                  value={`${exercise.name} ${exercise.workoutType} ${exercise.equipment ?? ""}`}
                  onSelect={() => {
                    onChange(exercise.name);
                    setOpen(false);
                  }}
                >
                  <Check className={value === exercise.name ? "opacity-100" : "opacity-0"} />
                  <span className="min-w-0 flex-1 truncate">{exercise.name}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {exercise.workoutType}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SetRowsEditor({
  rows,
  usesLoad,
  previousWorkout,
  onChange,
  onCopyPrevious,
  onRepeat,
  onAddBlank,
  onRemove,
}: {
  rows: WorkoutSetState[];
  usesLoad: boolean;
  previousWorkout?: { date: string; location?: string; rows: WorkoutSetState[] };
  onChange: <K extends keyof WorkoutSetState>(
    setIndex: number,
    key: K,
    value: WorkoutSetState[K],
  ) => void;
  onCopyPrevious: () => void;
  onRepeat: () => void;
  onAddBlank: () => void;
  onRemove: (setIndex: number) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
      {previousWorkout ? (
        <div className="space-y-2 rounded-md border border-border bg-background/70 p-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Previous workout · {formatUKDate(previousWorkout.date)}
              </p>
              <p className="text-xs text-muted-foreground">
                {previousWorkout.rows.length} {previousWorkout.rows.length === 1 ? "set" : "sets"}
                {previousWorkout.location ? ` · ${previousWorkout.location}` : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-full sm:w-auto"
              onClick={onCopyPrevious}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy previous workout
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {previousWorkout.rows.map((set, index) => (
              <span
                key={index}
                className="rounded-md bg-secondary px-2 py-1 text-[11px] text-foreground"
              >
                {index + 1}. {setSummary(set, usesLoad)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div
        className={`hidden items-end gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:grid ${
          usesLoad ? "grid-cols-[32px_1fr_1fr_1fr_32px]" : "grid-cols-[32px_1fr_1fr_32px]"
        }`}
      >
        <span>Set</span>
        {usesLoad && <span>kg</span>}
        <span>Reps</span>
        <span>RPE</span>
        <span />
      </div>
      {rows.map((set, setIndex) => (
        <div
          key={setIndex}
          className={`rounded-md border border-border/70 bg-background p-2 sm:grid sm:items-center sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0 ${
            usesLoad ? "sm:grid-cols-[32px_1fr_1fr_1fr_32px]" : "sm:grid-cols-[32px_1fr_1fr_32px]"
          }`}
        >
          <div className="mb-2 flex items-center justify-between sm:hidden">
            <span className="text-xs font-semibold text-muted-foreground">Set {setIndex + 1}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground"
              disabled={rows.length === 1}
              onClick={() => onRemove(setIndex)}
              aria-label={`Remove set ${setIndex + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <span className="hidden text-center text-sm font-semibold text-muted-foreground sm:block">
            {setIndex + 1}
          </span>
          <div
            className={`grid items-end gap-2 sm:contents ${
              usesLoad ? "grid-cols-[1fr_1fr_0.75fr]" : "grid-cols-[1fr_0.75fr]"
            }`}
          >
            {usesLoad && (
              <label className="space-y-1 sm:space-y-0">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:hidden">
                  Weight (kg)
                </span>
                <Input
                  inputMode="decimal"
                  className="h-12 text-lg font-semibold sm:h-10 sm:text-sm sm:font-normal"
                  aria-label={`Set ${setIndex + 1} weight`}
                  value={set.weight}
                  onChange={(event) => onChange(setIndex, "weight", event.target.value)}
                />
              </label>
            )}
            <label className="space-y-1 sm:space-y-0">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:hidden">
                Reps
              </span>
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                className="h-12 text-lg font-semibold sm:h-10 sm:text-sm sm:font-normal"
                aria-label={`Set ${setIndex + 1} reps`}
                value={set.reps}
                onChange={(event) => onChange(setIndex, "reps", event.target.value)}
              />
            </label>
            <label className="space-y-1 sm:space-y-0">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:hidden">
                RPE
              </span>
              <Input
                inputMode="decimal"
                className="h-12 text-base sm:h-10 sm:text-sm"
                aria-label={`Set ${setIndex + 1} RPE`}
                value={set.rpe}
                onChange={(event) => onChange(setIndex, "rpe", event.target.value)}
              />
            </label>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="hidden h-8 w-8 text-muted-foreground sm:inline-flex"
            disabled={rows.length === 1}
            onClick={() => onRemove(setIndex)}
            aria-label={`Remove set ${setIndex + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onRepeat}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Repeat last set
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onAddBlank}>
          <Plus className="mr-1 h-4 w-4" /> Add blank set
        </Button>
      </div>
    </div>
  );
}

function MetricFields({
  profile,
  form,
  update,
  intensities,
  qualities,
  assistanceTypes,
  usesLoad,
  usesStandardSets,
  isGrip,
  showIntensity,
}: {
  profile: MetricProfile;
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  intensities: string[];
  qualities: string[];
  assistanceTypes: string[];
  usesLoad: boolean;
  usesStandardSets: boolean;
  isGrip: boolean;
  showIntensity: boolean;
}) {
  if (profile === "mobility_position") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Distance (cm)">
          <Input
            inputMode="decimal"
            value={form.distance}
            onChange={(e) => update("distance", e.target.value)}
          />
        </Field>
        <Field label="Hold (sec)">
          <Input
            inputMode="decimal"
            value={form.holdSeconds}
            onChange={(e) => update("holdSeconds", e.target.value)}
          />
        </Field>
        <Field label="Feel (1-5)">
          <Input
            inputMode="decimal"
            value={form.feel}
            onChange={(e) => update("feel", e.target.value)}
          />
        </Field>
      </div>
    );
  }

  if (profile === "time") {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Minutes">
            <Input
              inputMode="numeric"
              value={form.duration}
              onChange={(e) => update("duration", e.target.value)}
            />
          </Field>
          <Field label="Distance">
            <Input
              inputMode="decimal"
              value={form.distance}
              onChange={(e) => update("distance", e.target.value)}
            />
          </Field>
          <Field label="Feel / RPE">
            <Input
              inputMode="decimal"
              value={form.feel || form.rpe}
              onChange={(e) => update("feel", e.target.value)}
            />
          </Field>
        </div>
        {showIntensity && <IntensityRow form={form} update={update} intensities={intensities} />}
      </div>
    );
  }

  if (profile === "carry") {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Rounds">
            <Input
              inputMode="numeric"
              value={form.sets}
              onChange={(e) => update("sets", e.target.value)}
            />
          </Field>
          <Field label="Distance">
            <Input
              inputMode="decimal"
              value={form.distance}
              onChange={(e) => update("distance", e.target.value)}
            />
          </Field>
          <Field label="Time">
            <Input
              inputMode="numeric"
              value={form.duration}
              onChange={(e) => update("duration", e.target.value)}
            />
          </Field>
          <Field label="Load">
            <Input
              inputMode="decimal"
              value={form.weight}
              onChange={(e) => update("weight", e.target.value)}
            />
          </Field>
        </div>
        <IntensityRow form={form} update={update} intensities={intensities} />
      </div>
    );
  }

  if (profile === "hold" || profile === "grip") {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Attempts">
            <Input
              inputMode="numeric"
              value={form.sets}
              onChange={(e) => update("sets", e.target.value)}
            />
          </Field>
          <Field label="Hold (sec)">
            <Input
              inputMode="decimal"
              value={form.holdSeconds}
              onChange={(e) => update("holdSeconds", e.target.value)}
            />
          </Field>
          <Field label="Feel / RPE">
            <Input
              inputMode="decimal"
              value={form.feel || form.rpe}
              onChange={(e) => update("feel", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={isGrip ? "Grip style" : "Progression"}>
            {isGrip ? (
              <SimpleSelect
                value={form.gripStyle}
                onChange={(v) => update("gripStyle", v)}
                options={GRIP_STYLES}
              />
            ) : (
              <Input
                value={form.progressionLevel}
                onChange={(e) => update("progressionLevel", e.target.value)}
              />
            )}
          </Field>
          <Field label={isGrip ? "Load type" : "Assistance"}>
            <SimpleSelect
              value={isGrip ? form.gripLoadType : form.assistanceType}
              onChange={(v) => (isGrip ? update("gripLoadType", v) : update("assistanceType", v))}
              options={isGrip ? GRIP_LOAD_TYPES : assistanceTypes}
            />
          </Field>
        </div>
        <Field label="Detail">
          <Input
            value={form.assistanceDetail || form.detail}
            onChange={(e) => {
              update("assistanceDetail", e.target.value);
              update("detail", e.target.value);
            }}
            placeholder={isGrip ? "20mm edge, +10kg..." : "Tuck, band, wall support..."}
          />
        </Field>
      </div>
    );
  }

  if (profile === "conditioning") {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Minutes">
            <Input
              inputMode="numeric"
              value={form.duration}
              onChange={(e) => update("duration", e.target.value)}
            />
          </Field>
          <Field label="Rounds">
            <Input
              inputMode="numeric"
              value={form.rounds || form.sets}
              onChange={(e) => update("rounds", e.target.value)}
            />
          </Field>
          <Field label="Load">
            <Input
              inputMode="decimal"
              value={form.weight}
              onChange={(e) => update("weight", e.target.value)}
            />
          </Field>
        </div>
        <IntensityRow form={form} update={update} intensities={intensities} />
        <Field label="Detail">
          <Input
            value={form.detail}
            onChange={(e) => update("detail", e.target.value)}
            placeholder="e.g. reps per minute"
          />
        </Field>
      </div>
    );
  }

  if (profile === "power") {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Sets">
            <Input
              inputMode="numeric"
              value={form.sets}
              onChange={(e) => update("sets", e.target.value)}
            />
          </Field>
          <Field label="Jumps">
            <Input
              inputMode="numeric"
              value={form.reps}
              onChange={(e) => update("reps", e.target.value)}
            />
          </Field>
          <Field label="Height (cm)">
            <Input
              inputMode="decimal"
              value={form.height}
              onChange={(e) => update("height", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quality">
            <SimpleSelect
              value={form.quality}
              onChange={(v) => update("quality", v)}
              options={qualities}
            />
          </Field>
          <Field label="RPE">
            <Input
              inputMode="decimal"
              value={form.rpe}
              onChange={(e) => update("rpe", e.target.value)}
            />
          </Field>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Sets">
          <Input
            inputMode="numeric"
            value={form.sets}
            onChange={(e) => update("sets", e.target.value)}
          />
        </Field>
        <Field label="Reps">
          <Input
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.reps}
            onChange={(e) => update("reps", e.target.value)}
          />
        </Field>
        {usesLoad && (
          <Field label="Weight">
            <Input
              inputMode="decimal"
              value={form.weight}
              onChange={(e) => update("weight", e.target.value)}
            />
          </Field>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Min">
          <Input
            inputMode="numeric"
            value={form.duration}
            onChange={(e) => update("duration", e.target.value)}
          />
        </Field>
        <Field label="Intensity">
          <SimpleSelect
            value={form.intensity}
            onChange={(v) => update("intensity", v)}
            options={intensities}
          />
        </Field>
        <Field label="RPE">
          <Input
            inputMode="decimal"
            value={form.rpe}
            onChange={(e) => update("rpe", e.target.value)}
          />
        </Field>
      </div>
      {usesStandardSets && (
        <Field label="Rest between sets">
          <SimpleSelect
            value={form.restTime}
            onChange={(v) => update("restTime", v)}
            options={REST_OPTIONS}
          />
        </Field>
      )}
    </div>
  );
}

function IntensityRow({
  form,
  update,
  intensities,
}: {
  form: FormState;
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  intensities: string[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Intensity">
        <SimpleSelect
          value={form.intensity}
          onChange={(v) => update("intensity", v)}
          options={intensities}
        />
      </Field>
      <Field label="RPE">
        <Input
          inputMode="decimal"
          value={form.rpe}
          onChange={(e) => update("rpe", e.target.value)}
        />
      </Field>
    </div>
  );
}
