import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  CircleCheck,
  ChevronsUpDown,
  Copy,
  Dumbbell,
  History,
  Layers3,
  Loader2,
  Plus,
  Pencil,
  RotateCcw,
  Star,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  replaceWorkoutSessionClient,
  REST_OPTIONS,
} from "@/lib/supabase-log.browser";
import { formatUKDate, todayISO } from "@/lib/date";
import {
  completeSuggestedWorkoutClient,
  getNextSuggestedWorkoutsClient,
  updateSuggestedWorkoutStatusClient,
  type SavedWorkoutPlan,
} from "@/lib/supabase-plans.browser";
import {
  lastCompletedWorkoutKey,
  WORKOUT_REPEAT_SESSION_KEY,
  workoutFavoritesKey,
  workoutSessionDraftKey,
} from "@/lib/workout-local-state";
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
  listTrainingMethodsClient,
  type TrainingMethod,
} from "@/lib/supabase-training-methods.browser";
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
  clientId: string;
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
  climbingTrackingMode: string;
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

type WorkoutMethodBlockState = {
  id: string;
  trainingMethodId: string;
  methodName: string;
  family: "exercise_group" | "timed_density";
  memberClientIds: string[];
  rounds: string;
  restBetweenMovementsSeconds: string;
  restBetweenRoundsSeconds: string;
  blockDurationMinutes: string;
  workIntervalSeconds: string;
  restIntervalSeconds: string;
  completedRounds: string;
  config: Record<string, number | string | boolean>;
};

type MethodBlockEditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; blockId: string };

type WorkoutSetState = {
  reps: string;
  weight: string;
  rpe: string;
  completed: boolean;
  method?: WorkoutSetMethodState;
};

type WorkoutSetSegmentState = {
  reps: string;
  weight: string;
  rpe: string;
  restAfterSeconds: string;
  rangeOfMotion: string;
};

type WorkoutSetMethodState = {
  trainingMethodId: string;
  methodName: string;
  systemKey?: string | null;
  segments: WorkoutSetSegmentState[];
  config: Record<string, number | string | boolean>;
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
  methodBlocks: WorkoutMethodBlockState[];
};

type RecentSessionTemplate = {
  id: string;
  date: string;
  title: string;
  location?: { name: string; kind: string } | null;
  entries: FormState[];
  methodBlocks: WorkoutMethodBlockState[];
};

let clientIdCounter = 0;
const newClientId = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${++clientIdCounter}`;

const blank = (defaultWorkoutType = ""): FormState => ({
  clientId: newClientId("movement"),
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
  climbingTrackingMode: "",
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
  methodBlocks: [],
});

type StoredWorkoutSessionDraft = {
  version: 1;
  savedAt: string;
  form: SessionFormState;
  loadedSuggestionId: string | null;
  editingSessionId?: string | null;
};

type StoredCompletedWorkout = {
  version: 1;
  savedAt: string;
  sessionId: string;
  form: SessionFormState;
};

function isSessionFormState(form: unknown): form is SessionFormState {
  if (!form || typeof form !== "object") return false;
  const candidate = form as SessionFormState;
  return Boolean(
    typeof candidate.date === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.trainingLocationId === "string" &&
    Array.isArray(candidate.entries) &&
    candidate.entries.length > 0 &&
    candidate.entries.every(
      (entry) =>
        entry &&
        typeof entry.exercise === "string" &&
        typeof entry.workoutType === "string" &&
        Array.isArray(entry.setRows),
    ) &&
    (candidate.methodBlocks == null || Array.isArray(candidate.methodBlocks)),
  );
}

function normalizeSessionForm(form: SessionFormState): SessionFormState {
  const entries = form.entries.map((entry) => ({
    ...entry,
    clientId:
      typeof entry.clientId === "string" && entry.clientId
        ? entry.clientId
        : newClientId("movement"),
    setRows: entry.setRows.map((set) => ({
      ...set,
      method:
        set.method &&
        typeof set.method.trainingMethodId === "string" &&
        Array.isArray(set.method.segments)
          ? {
              ...set.method,
              systemKey:
                typeof set.method.systemKey === "string"
                  ? set.method.systemKey
                  : typeof set.method.config?.system_key === "string"
                    ? String(set.method.config.system_key)
                    : null,
              segments: set.method.segments.map((segment) => ({
                reps: String(segment.reps ?? ""),
                weight: String(segment.weight ?? ""),
                rpe: String(segment.rpe ?? ""),
                restAfterSeconds: String(segment.restAfterSeconds ?? ""),
                rangeOfMotion: String(segment.rangeOfMotion ?? "full"),
              })),
            }
          : undefined,
    })),
  }));
  const entryIds = new Set(entries.map((entry) => entry.clientId));
  const storedBlocks = Array.isArray(form.methodBlocks) ? form.methodBlocks : [];
  const methodBlocks = storedBlocks
    .map((block) => ({
      ...block,
      id: typeof block.id === "string" && block.id ? block.id : newClientId("method"),
      memberClientIds: Array.isArray(block.memberClientIds)
        ? block.memberClientIds.filter((id) => entryIds.has(id))
        : [],
      blockDurationMinutes: String(block.blockDurationMinutes ?? ""),
      workIntervalSeconds: String(block.workIntervalSeconds ?? ""),
      restIntervalSeconds: String(block.restIntervalSeconds ?? ""),
      completedRounds: String(block.completedRounds ?? ""),
    }))
    .filter(
      (block) =>
        (block.family === "exercise_group" || block.family === "timed_density") &&
        typeof block.trainingMethodId === "string" &&
        block.memberClientIds.length >= (block.family === "timed_density" ? 1 : 2),
    );
  return { ...form, entries, methodBlocks };
}

function readWorkoutSessionDraft(value: string | null): StoredWorkoutSessionDraft | null {
  if (!value) return null;
  try {
    const draft = JSON.parse(value) as StoredWorkoutSessionDraft;
    if (
      draft.version !== 1 ||
      typeof draft.savedAt !== "string" ||
      Number.isNaN(Date.parse(draft.savedAt)) ||
      !isSessionFormState(draft.form) ||
      (draft.loadedSuggestionId != null && typeof draft.loadedSuggestionId !== "string") ||
      (draft.editingSessionId != null && typeof draft.editingSessionId !== "string")
    ) {
      return null;
    }
    return { ...draft, form: normalizeSessionForm(draft.form) };
  } catch {
    return null;
  }
}

function readCompletedWorkout(value: string | null): StoredCompletedWorkout | null {
  if (!value) return null;
  try {
    const completed = JSON.parse(value) as StoredCompletedWorkout;
    if (
      completed.version !== 1 ||
      typeof completed.savedAt !== "string" ||
      Number.isNaN(Date.parse(completed.savedAt)) ||
      typeof completed.sessionId !== "string" ||
      !completed.sessionId ||
      !isSessionFormState(completed.form) ||
      completed.form.date !== today()
    ) {
      return null;
    }
    return { ...completed, form: normalizeSessionForm(completed.form) };
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
    "climbingTrackingMode",
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
    entry.setRows.some(
      (set) => set.reps || set.weight || set.rpe || !set.completed || Boolean(set.method),
    )
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
    form.methodBlocks.length > 0 ||
    form.entries.some(entryHasDraftContent),
  );
}

function readWorkoutFavorites(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      : [];
  } catch {
    return [];
  }
}

function setRowsFromRecentLog(log: RecentWorkoutLog): WorkoutSetState[] {
  if (log.setRows.length > 1 || log.setRows.some((set) => set.method)) {
    return log.setRows.map((set) => ({
      ...set,
      rpe: "",
      completed: true,
      method: set.method
        ? {
            ...set.method,
            segments: set.method.segments.map((segment) => ({ ...segment, rpe: "" })),
          }
        : undefined,
    }));
  }
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
  const drops = set.method?.segments
    .map((segment) =>
      [segment.weight ? `${segment.weight} kg` : "", segment.reps ? `${segment.reps} reps` : ""]
        .filter(Boolean)
        .join(" × "),
    )
    .filter(Boolean);
  return (
    [load, reps, rpe, drops?.length ? `${set.method?.methodName}: ${drops.join(" → ")}` : ""]
      .filter(Boolean)
      .join(" · ") || "No values recorded"
  );
}

function workoutEntrySummary(entry: FormState) {
  const sets = entry.setRows.filter((set) => set.reps || set.weight || set.rpe || set.method);
  if (sets.length > 0) {
    const segments = sets.flatMap((set) => [
      { reps: set.reps, weight: set.weight },
      ...(set.method?.segments ?? []),
    ]);
    const reps = segments.reduce((total, set) => total + (Number(set.reps) || 0), 0);
    const volume = sets.reduce(
      (total, set) =>
        total +
        [{ reps: set.reps, weight: set.weight }, ...(set.method?.segments ?? [])].reduce(
          (setTotal, segment) =>
            setTotal + (Number(segment.weight) || 0) * (Number(segment.reps) || 0),
          0,
        ),
      0,
    );
    const methodSegments = sets.reduce(
      (total, set) => total + (set.method?.segments.length ?? 0),
      0,
    );
    return [
      `${sets.length} ${sets.length === 1 ? "set" : "sets"}`,
      methodSegments
        ? `${methodSegments} extra ${methodSegments === 1 ? "segment" : "segments"}`
        : "",
      reps > 0 ? `${reps} reps` : "",
      volume > 0 ? `${Math.round(volume).toLocaleString()} kg volume` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return (
    [
      entry.duration ? `${entry.duration} min` : "",
      entry.holdSeconds ? `${entry.holdSeconds}s hold` : "",
      entry.distance ? `${entry.distance}${entry.distanceUnit || ""}` : "",
      entry.rounds ? `${entry.rounds} rounds` : "",
      entry.height ? `${entry.height} cm` : "",
      entry.climbingBoulders ? `${entry.climbingBoulders} problems/routes` : "",
      entry.climbingMaxGrade ? `Grade ${entry.climbingMaxGrade}` : "",
      entry.reps ? `${entry.reps} reps` : "",
      entry.rpe ? `RPE ${entry.rpe}` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "No performance values entered"
  );
}

function entryFromRecentLog(log: RecentWorkoutLog): FormState {
  return {
    ...blankSessionEntry(),
    entryKind: log.entryKind || "Workout",
    workoutType: log.workoutType || "Other",
    focusArea: log.focusArea,
    exercise: log.exercise,
    sets: log.sets,
    reps: log.reps,
    weight: log.weight,
    duration: log.duration,
    intensity: log.intensity,
    rpe: log.rpe,
    restTime: log.restTime,
    completed: true,
    notes: "",
    progressionLevel: log.progressionLevel,
    holdSeconds: log.holdSeconds,
    assistanceType: log.assistanceType,
    assistanceDetail: log.assistanceDetail,
    quality: log.quality,
    distance: log.distance,
    distanceUnit: log.distanceUnit,
    rounds: log.rounds,
    feel: log.feel,
    height: log.height,
    detail: log.detail,
    climbingBoulders: log.climbingBoulders,
    climbingTrackingMode: log.climbingTrackingMode
      ? ["Hours", "Time only"].includes(log.climbingTrackingMode)
        ? "Time only"
        : "Problems / routes"
      : "",
    climbingMaxGrade: log.climbingMaxGrade,
    climbingGradient: log.climbingGradient,
    setRows: setRowsFromRecentLog(log),
  };
}

function buildRecentSessionTemplates(
  logs: RecentWorkoutLog[],
  locationKind?: string,
): RecentSessionTemplate[] {
  const completed = logs.filter((log) => log.completed && log.exercise && log.id);
  const locationMatches = locationKind
    ? completed.filter((log) => log.trainingLocation?.kind === locationKind)
    : completed;
  const source = locationMatches.length > 0 ? locationMatches : completed;
  const sessions = new Map<string, RecentSessionTemplate>();
  const movementOrder = new Map<string, number>();
  const entryClientIds = new Map<string, string>();

  for (const log of source) {
    const current = sessions.get(log.id) ?? {
      id: log.id,
      date: log.date,
      title: log.sessionTitle || "Workout",
      location: log.trainingLocation,
      entries: [],
      methodBlocks: [],
    };
    if (
      !current.entries.some((entry) => entry.exercise.toLowerCase() === log.exercise.toLowerCase())
    ) {
      const entry = entryFromRecentLog(log);
      current.entries.push(entry);
      entryClientIds.set(`${log.id}:${log.entryId}`, entry.clientId);
      movementOrder.set(`${log.id}:${log.exercise.toLowerCase()}`, log.orderIndex);
    }
    sessions.set(log.id, current);
  }

  return Array.from(sessions.values())
    .map((session) => {
      const sourceBlocks = logs.find((log) => log.id === session.id)?.methodBlocks ?? [];
      const methodBlocks = sourceBlocks
        .map((block) => ({
          id: newClientId("method"),
          trainingMethodId: block.trainingMethodId,
          methodName: block.methodName,
          family: block.family,
          rounds: block.rounds,
          restBetweenMovementsSeconds: block.restBetweenMovementsSeconds,
          restBetweenRoundsSeconds: block.restBetweenRoundsSeconds,
          blockDurationMinutes: block.blockDurationMinutes,
          workIntervalSeconds: block.workIntervalSeconds,
          restIntervalSeconds: block.restIntervalSeconds,
          completedRounds: "",
          memberClientIds: block.memberEntryIds
            .map((entryId) => entryClientIds.get(`${session.id}:${entryId}`))
            .filter((id): id is string => Boolean(id)),
          config: block.config,
        }))
        .filter((block) =>
          block.family === "timed_density"
            ? block.memberClientIds.length >= 1
            : block.memberClientIds.length >= 2,
        );
      return {
        ...session,
        entries: session.entries.sort(
          (left, right) =>
            (movementOrder.get(`${session.id}:${left.exercise.toLowerCase()}`) ?? 0) -
            (movementOrder.get(`${session.id}:${right.exercise.toLowerCase()}`) ?? 0),
        ),
        methodBlocks,
      };
    })
    .slice(0, 4);
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
  const favoritesStorageKey = useMemo(workoutFavoritesKey, []);
  const lastCompletedStorageKey = useMemo(lastCompletedWorkoutKey, []);
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
  const methods = useQuery({
    queryKey: ["training-methods", "workout-composer"],
    queryFn: () => listTrainingMethodsClient(),
  });
  const [form, setForm] = useState<SessionFormState>(() => blankSession());
  const [initialFormLoaded, setInitialFormLoaded] = useState(false);
  const [loadedSuggestionId, setLoadedSuggestionId] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [discardDraftOpen, setDiscardDraftOpen] = useState(false);
  const [finishSummaryOpen, setFinishSummaryOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [lastCompletedWorkout, setLastCompletedWorkout] = useState<StoredCompletedWorkout | null>(
    null,
  );
  const [favoriteExercises, setFavoriteExercises] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [pendingRecentSession, setPendingRecentSession] = useState<RecentSessionTemplate | null>(
    null,
  );
  const [methodBlockEditor, setMethodBlockEditor] = useState<MethodBlockEditorState>({
    mode: "closed",
  });
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
  const recentExerciseNames = useMemo(() => {
    const completed = (recent.data?.recent ?? []).filter((item) => item.completed && item.exercise);
    const locationMatches = selectedLocationKind
      ? completed.filter((item) => item.trainingLocation?.kind === selectedLocationKind)
      : completed;
    const source = locationMatches.length > 0 ? locationMatches : completed;
    return Array.from(new Set(source.map((item) => item.exercise))).slice(0, 10);
  }, [recent.data?.recent, selectedLocationKind]);
  const recentSessionTemplates = useMemo(
    () => buildRecentSessionTemplates(recent.data?.recent ?? [], selectedLocationKind),
    [recent.data?.recent, selectedLocationKind],
  );
  const exerciseGroupMethods = useMemo(
    () =>
      (methods.data?.items ?? []).filter(
        (method) => method.family === "exercise_group" && method.isActive && method.isEnabled,
      ),
    [methods.data?.items],
  );
  const timedDensityMethods = useMemo(
    () =>
      (methods.data?.items ?? []).filter(
        (method) => method.family === "timed_density" && method.isActive && method.isEnabled,
      ),
    [methods.data?.items],
  );
  const blockMethods = useMemo(
    () => [...exerciseGroupMethods, ...timedDensityMethods],
    [exerciseGroupMethods, timedDensityMethods],
  );
  const setMethods = useMemo(
    () =>
      (methods.data?.items ?? [])
        .filter(
          (method) =>
            method.family === "set_method" &&
            method.isActive &&
            method.isEnabled &&
            ([
              "drop_set",
              "cluster_set",
              "rest_pause",
              "rep_targeting",
              "partial_reps",
              "eccentrics",
              "pyramid",
              "negatives",
            ].includes(method.systemKey ?? "") ||
              method.systemKey == null),
        )
        .sort(
          (left, right) =>
            [
              "drop_set",
              "cluster_set",
              "rest_pause",
              "rep_targeting",
              "partial_reps",
              "eccentrics",
              "pyramid",
              "negatives",
              null,
            ].indexOf(left.systemKey) -
            [
              "drop_set",
              "cluster_set",
              "rest_pause",
              "rep_targeting",
              "partial_reps",
              "eccentrics",
              "pyramid",
              "negatives",
              null,
            ].indexOf(right.systemKey),
        ),
    [methods.data?.items],
  );

  useEffect(() => {
    setFavoriteExercises(readWorkoutFavorites(window.localStorage.getItem(favoritesStorageKey)));
    setFavoritesLoaded(true);
  }, [favoritesStorageKey]);

  useEffect(() => {
    const stored = window.localStorage.getItem(lastCompletedStorageKey);
    const completed = readCompletedWorkout(stored);
    setLastCompletedWorkout(completed);
    if (stored && !completed) window.localStorage.removeItem(lastCompletedStorageKey);
  }, [lastCompletedStorageKey]);

  useEffect(() => {
    if (!favoritesLoaded) return;
    window.localStorage.setItem(favoritesStorageKey, JSON.stringify(favoriteExercises));
  }, [favoriteExercises, favoritesLoaded, favoritesStorageKey]);

  const loadPlanIntoForm = useCallback(
    (draft: WorkoutPlanDraft) => {
      const trainingLocation = locations.data?.find(
        (location) => location.kind === draft.locationKind,
      );
      const entries = draft.movements.map((movement) => ({
        ...blankSessionEntry(),
        exercise: movement.exercise,
        workoutType: movement.workoutType,
        setRows: movement.setRows.map((set) => ({ ...set, completed: true })),
      }));
      const methodBlocks = (draft.methodBlocks ?? [])
        .map((block) => ({
          id: newClientId("method"),
          trainingMethodId: block.trainingMethodId,
          methodName: block.methodName,
          family: block.family,
          memberClientIds: block.memberMovementIndexes
            .map((index) => entries[index]?.clientId)
            .filter((id): id is string => Boolean(id)),
          rounds: block.rounds,
          restBetweenMovementsSeconds: block.restBetweenMovementsSeconds,
          restBetweenRoundsSeconds: block.restBetweenRoundsSeconds,
          blockDurationMinutes: block.blockDurationMinutes,
          workIntervalSeconds: block.workIntervalSeconds,
          restIntervalSeconds: block.restIntervalSeconds,
          completedRounds: "",
          config: block.config,
        }))
        .filter((block) =>
          block.family === "timed_density"
            ? block.memberClientIds.length >= 1
            : block.memberClientIds.length >= 2,
        );
      setForm({
        ...blankSession(),
        title: draft.title,
        trainingLocationId: trainingLocation?.id ?? "",
        entries,
        methodBlocks,
      });
      setLoadedSuggestionId(draft.suggestedWorkoutId ?? null);
      setEditingSessionId(null);
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
      setEditingSessionId(sessionDraft.editingSessionId ?? null);
      setDraftSavedAt(sessionDraft.savedAt);
      toast.message("Workout draft restored", {
        description: "Your unfinished workout is ready to continue.",
      });
      setInitialFormLoaded(true);
      return;
    } else if (storedSessionDraft) {
      window.localStorage.removeItem(draftStorageKey);
    }

    const repeatSessionId = window.localStorage.getItem(WORKOUT_REPEAT_SESSION_KEY);
    if (repeatSessionId) {
      if (!recent.data || !locations.data?.length) return;
      const session = buildRecentSessionTemplates(recent.data.recent).find(
        (item) => item.id === repeatSessionId,
      );
      window.localStorage.removeItem(WORKOUT_REPEAT_SESSION_KEY);
      if (session) {
        const sessionLocation = locations.data.find(
          (location) => location.kind === session.location?.kind,
        );
        setForm({
          ...blankSession(),
          title: session.title,
          trainingLocationId: sessionLocation?.id ?? "",
          entries: session.entries.map((entry) => ({
            ...entry,
            setRows: entry.setRows.map((set) => ({ ...set, rpe: "", completed: true })),
          })),
          methodBlocks: session.methodBlocks,
        });
        toast.message("Recent workout loaded", {
          description: `${session.entries.length} movements copied from ${formatUKDate(session.date)}.`,
        });
      }
    }
    setInitialFormLoaded(true);
  }, [draftStorageKey, initialFormLoaded, loadPlanIntoForm, locations.data, recent.data]);

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
      editingSessionId,
    };
    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    setDraftSavedAt(savedAt);
  }, [draftStorageKey, editingSessionId, form, initialFormLoaded, loadedSuggestionId]);

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
    setEditingSessionId(null);
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
  const moveEntry = (fromIndex: number, direction: -1 | 1) =>
    setForm((current) => {
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= current.entries.length) return current;
      const entries = [...current.entries];
      [entries[fromIndex], entries[toIndex]] = [entries[toIndex], entries[fromIndex]];
      const order = new Map(entries.map((entry, index) => [entry.clientId, index]));
      const methodBlocks = current.methodBlocks.map((block) => ({
        ...block,
        memberClientIds: [...block.memberClientIds].sort(
          (left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0),
        ),
      }));
      return { ...current, entries, methodBlocks };
    });
  const removeEntry = (index: number) =>
    setForm((current) => {
      if (current.entries.length === 1) return current;
      const removedId = current.entries[index]?.clientId;
      const methodBlocks = current.methodBlocks
        .map((block) => ({
          ...block,
          memberClientIds: block.memberClientIds.filter((id) => id !== removedId),
        }))
        .filter((block) =>
          block.family === "timed_density"
            ? block.memberClientIds.length >= 1
            : block.memberClientIds.length >= 2,
        );
      return {
        ...current,
        entries: current.entries.filter((_, i) => i !== index),
        methodBlocks,
      };
    });
  const saveMethodBlock = (block: WorkoutMethodBlockState) => {
    setForm((current) => ({
      ...current,
      methodBlocks:
        methodBlockEditor.mode === "edit"
          ? current.methodBlocks.map((item) => (item.id === block.id ? block : item))
          : [...current.methodBlocks, block],
    }));
    setMethodBlockEditor({ mode: "closed" });
  };
  const removeMethodBlock = (blockId: string) =>
    setForm((current) => ({
      ...current,
      methodBlocks: current.methodBlocks.filter((block) => block.id !== blockId),
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
          setRows: [
            ...entry.setRows,
            {
              ...previous,
              rpe: "",
              completed: true,
              method: previous.method
                ? {
                    ...previous.method,
                    segments: previous.method.segments.map((segment) => ({
                      ...segment,
                      rpe: "",
                    })),
                  }
                : undefined,
            },
          ],
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

  const addSetMethod = (entryIndex: number, setIndex: number, method: TrainingMethod) => {
    const set = form.entries[entryIndex]?.setRows[setIndex];
    if (!set) return;
    const dropPercentage = Number(method.defaultConfig.percentage_drop) || 15;
    const startingWeight = Number(set.weight);
    const isDropSet = method.systemKey === "drop_set";
    const isClusterSet = method.systemKey === "cluster_set";
    const isPartialReps = method.systemKey === "partial_reps";
    const suggestedWeight =
      Number.isFinite(startingWeight) && startingWeight > 0
        ? isDropSet
          ? String(Math.round(startingWeight * (1 - dropPercentage / 100) * 2) / 2)
          : String(startingWeight)
        : "";
    updateSet(entryIndex, setIndex, "method", {
      trainingMethodId: method.id,
      methodName: method.name,
      systemKey: method.systemKey,
      segments: [
        {
          reps: isClusterSet ? String(method.defaultConfig.reps_per_segment ?? 2) : "",
          weight: suggestedWeight,
          rpe: "",
          restAfterSeconds: String(method.defaultConfig.rest_between_segments_seconds ?? 10),
          rangeOfMotion: isPartialReps ? "partial" : "full",
        },
      ],
      config: {
        ...method.defaultConfig,
        system_key: method.systemKey ?? "custom",
        base_range_of_motion: "full",
      },
    });
    if (isClusterSet && !set.reps) {
      updateSet(entryIndex, setIndex, "reps", String(method.defaultConfig.reps_per_segment ?? 2));
    }
  };

  const addSetSegment = (entryIndex: number, setIndex: number) => {
    const method = form.entries[entryIndex]?.setRows[setIndex]?.method;
    if (!method) return;
    const previous = method.segments[method.segments.length - 1];
    const set = form.entries[entryIndex]?.setRows[setIndex];
    const systemKey = method.systemKey ?? String(method.config.system_key ?? "");
    const isDropSet = systemKey === "drop_set" || method.methodName.toLowerCase().includes("drop");
    const isClusterSet =
      systemKey === "cluster_set" || method.methodName.toLowerCase().includes("cluster");
    const isPartialReps =
      systemKey === "partial_reps" || method.methodName.toLowerCase().includes("partial");
    const dropPercentage = Number(method.config.percentage_drop) || 15;
    const previousWeight = Number(previous?.weight || set?.weight);
    const suggestedWeight =
      Number.isFinite(previousWeight) && previousWeight > 0
        ? isDropSet
          ? String(Math.round(previousWeight * (1 - dropPercentage / 100) * 2) / 2)
          : String(previousWeight)
        : "";
    updateSet(entryIndex, setIndex, "method", {
      ...method,
      segments: [
        ...method.segments,
        {
          reps: isClusterSet ? String(method.config.reps_per_segment ?? 2) : "",
          weight: suggestedWeight,
          rpe: "",
          restAfterSeconds: String(method.config.rest_between_segments_seconds ?? 10),
          rangeOfMotion: isPartialReps ? "partial" : "full",
        },
      ],
    });
  };

  const updateSetSegment = <K extends keyof WorkoutSetSegmentState>(
    entryIndex: number,
    setIndex: number,
    segmentIndex: number,
    key: K,
    value: WorkoutSetSegmentState[K],
  ) => {
    const method = form.entries[entryIndex]?.setRows[setIndex]?.method;
    if (!method) return;
    updateSet(entryIndex, setIndex, "method", {
      ...method,
      segments: method.segments.map((segment, index) =>
        index === segmentIndex ? { ...segment, [key]: value } : segment,
      ),
    });
  };

  const removeSetSegment = (entryIndex: number, setIndex: number, segmentIndex: number) => {
    const method = form.entries[entryIndex]?.setRows[setIndex]?.method;
    if (!method) return;
    const segments = method.segments.filter((_, index) => index !== segmentIndex);
    updateSet(
      entryIndex,
      setIndex,
      "method",
      segments.length ? { ...method, segments } : undefined,
    );
  };

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

  const toggleFavoriteExercise = (exerciseName: string) => {
    const normalized = exerciseName.trim().toLowerCase();
    if (!normalized) return;
    setFavoriteExercises((current) =>
      current.some((item) => item.toLowerCase() === normalized)
        ? current.filter((item) => item.toLowerCase() !== normalized)
        : [...current, exerciseName],
    );
  };

  const loadRecentSession = (session: RecentSessionTemplate) => {
    const sessionLocation = locations.data?.find(
      (location) => location.kind === session.location?.kind,
    );
    setForm((current) => ({
      ...blankSession(),
      date: current.date,
      title: session.title,
      trainingLocationId: sessionLocation?.id ?? current.trainingLocationId,
      entries: session.entries.map((entry) => ({
        ...entry,
        setRows: entry.setRows.map((set) => ({ ...set, rpe: "", completed: true })),
      })),
      methodBlocks: session.methodBlocks,
    }));
    setLoadedSuggestionId(null);
    setEditingSessionId(null);
    setPendingRecentSession(null);
    toast.message("Recent workout loaded", {
      description: `${session.entries.length} movements copied from ${formatUKDate(session.date)}.`,
    });
  };

  const requestRecentSession = (session: RecentSessionTemplate) => {
    if (sessionHasDraftContent(form)) {
      setPendingRecentSession(session);
      return;
    }
    loadRecentSession(session);
  };

  const buildWorkoutPayload = () => ({
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
        entry.workoutType === SKILL_WORKOUT_TYPE || selected?.workoutType === SKILL_WORKOUT_TYPE;
      const isGrip =
        entry.workoutType === GRIP_WORKOUT_TYPE || selected?.workoutType === GRIP_WORKOUT_TYPE;
      const isYoga =
        entry.workoutType === YOGA_WORKOUT_TYPE || selected?.workoutType === YOGA_WORKOUT_TYPE;

      return {
        ...entry,
        setRows: profileUsesStandardSets(profile) ? entry.setRows : [],
        date: form.date,
        workoutType: selected?.workoutType ?? entry.workoutType,
        focusArea: "",
        completed: form.completed,
        progressionLevel: isGrip ? entry.gripStyle : entry.progressionLevel,
        assistanceType: isGrip ? entry.gripLoadType : entry.assistanceType,
        entryKind:
          profile === "climbing"
            ? "Climbing"
            : isYoga || profile === "time" || profile === "duration" || profile === "conditioning"
              ? "Workout"
              : isGrip
                ? GRIP_WORKOUT_TYPE
                : isSkill
                  ? "Skill"
                  : entry.entryKind || "Workout",
      };
    }),
    methodBlocks: form.methodBlocks.map((block) => ({
      trainingMethodId: block.trainingMethodId,
      methodName: block.methodName,
      family: block.family,
      rounds: block.rounds,
      restBetweenMovementsSeconds: block.restBetweenMovementsSeconds,
      restBetweenRoundsSeconds: block.restBetweenRoundsSeconds,
      blockDurationMinutes: block.blockDurationMinutes,
      workIntervalSeconds: block.workIntervalSeconds,
      restIntervalSeconds: block.restIntervalSeconds,
      completedRounds: block.completedRounds,
      memberClientIds: block.memberClientIds,
      config: block.config,
    })),
  });

  const mutate = useMutation({
    mutationFn: async () => {
      if (editingSessionId) {
        const result = await replaceWorkoutSessionClient(editingSessionId, buildWorkoutPayload());
        return { ...result, wasCorrection: true };
      }
      const result = await addWorkoutSessionClient(buildWorkoutPayload());
      return { ...result, wasCorrection: false, planRelinkFailed: false };
    },
    onSuccess: async (result) => {
      window.localStorage.removeItem(draftStorageKey);
      if (loadedSuggestionId && !result.wasCorrection) {
        try {
          await completeSuggestedWorkoutClient(loadedSuggestionId, result.sessionId);
          qc.invalidateQueries({ queryKey: ["next-suggested-workouts"] });
        } catch {
          toast.warning("Workout saved, but the plan could not be marked complete.");
        }
      }
      if (result.planRelinkFailed) {
        toast.warning("Workout updated, but its saved plan link could not be restored.");
      }
      const completed: StoredCompletedWorkout = {
        version: 1,
        savedAt: new Date().toISOString(),
        sessionId: result.sessionId,
        form,
      };
      if (form.date === today()) {
        window.localStorage.setItem(lastCompletedStorageKey, JSON.stringify(completed));
        setLastCompletedWorkout(completed);
      } else if (result.wasCorrection) {
        window.localStorage.removeItem(lastCompletedStorageKey);
        setLastCompletedWorkout(null);
      }
      toast.success(result.wasCorrection ? "Workout updated" : "Workout session saved", {
        description: `${form.entries.filter((entry) => entry.exercise).length} movements were ${
          result.wasCorrection ? "updated" : "added"
        }.`,
      });
      setFinishSummaryOpen(false);
      setForm(blankSession());
      setLoadedSuggestionId(null);
      setEditingSessionId(null);
      qc.invalidateQueries({ queryKey: ["recent-workouts"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["prs"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
      qc.invalidateQueries({ queryKey: ["exercise-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const incompleteSetMethod = form.entries.some((entry) =>
    entry.setRows.some(
      (set) =>
        set.method &&
        (!set.reps ||
          !set.weight ||
          set.method.segments.some((segment) => !segment.reps || !segment.weight)),
    ),
  );
  const canSubmit =
    form.date &&
    form.trainingLocationId &&
    form.entries.some((entry) => entry.exercise.trim()) &&
    !incompleteSetMethod &&
    !mutate.isPending;
  const hasDraftContent = sessionHasDraftContent(form);
  const draftTime = draftSavedAt
    ? new Date(draftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  const workoutEntries = form.entries.filter((entry) => entry.exercise.trim());
  const selectedLocation = locations.data?.find(
    (location) => location.id === form.trainingLocationId,
  );
  const totalRecordedSets = workoutEntries.reduce(
    (total, entry) =>
      total + entry.setRows.filter((set) => set.reps || set.weight || set.rpe || set.method).length,
    0,
  );
  const totalMethods =
    form.methodBlocks.length +
    workoutEntries.reduce(
      (total, entry) => total + entry.setRows.filter((set) => Boolean(set.method)).length,
      0,
    );

  const editLastCompletedWorkout = () => {
    if (!lastCompletedWorkout) return;
    setForm(lastCompletedWorkout.form);
    setEditingSessionId(lastCompletedWorkout.sessionId);
    setLoadedSuggestionId(null);
    toast.message("Workout reopened", {
      description: "Make your corrections, then review and finish again.",
    });
  };

  const cancelCorrection = () => {
    window.localStorage.removeItem(draftStorageKey);
    setForm(blankSession());
    setEditingSessionId(null);
    setDraftSavedAt(null);
    toast.message("Correction cancelled", {
      description: "The completed workout was not changed.",
    });
  };

  return (
    <div className="space-y-6">
      {editingSessionId ? (
        <Card className="flex flex-col gap-3 border-amber-400/30 bg-amber-400/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Pencil className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="font-semibold">Correcting today&apos;s workout</p>
              <p className="text-xs text-muted-foreground">
                Finishing will safely replace the completed session with this corrected version.
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={cancelCorrection}>
            Cancel correction
          </Button>
        </Card>
      ) : lastCompletedWorkout && !hasDraftContent ? (
        <Card className="flex flex-col gap-3 border-emerald-400/30 bg-emerald-400/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <div>
              <p className="font-semibold">Today&apos;s workout is saved</p>
              <p className="text-xs text-muted-foreground">
                {lastCompletedWorkout.form.entries.filter((entry) => entry.exercise).length}{" "}
                movements · Finished at{" "}
                {new Date(lastCompletedWorkout.savedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={editLastCompletedWorkout}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit workout
          </Button>
        </Card>
      ) : null}
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
              <span className="text-[10px] text-muted-foreground">
                {draftTime ? `Autosaved ${draftTime}` : "Autosaving…"}
              </span>
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

        {recentSessionTemplates.length > 0 ? (
          <details className="rounded-lg border border-border bg-secondary/20 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">
              Repeat a recent workout
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {recentSessionTemplates.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className="rounded-md border border-border bg-background p-3 text-left transition-colors hover:bg-secondary/60"
                  onClick={() => requestRecentSession(session)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{session.title}</span>
                    <History className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatUKDate(session.date)} · {session.entries.length} movements
                    {session.location?.name ? ` · ${session.location.name}` : ""}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                    {session.entries.map((entry) => entry.exercise).join(", ")}
                  </span>
                </button>
              ))}
            </div>
          </details>
        ) : null}

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

      <div>
        <h2 className="text-base font-semibold">1. Add movements and sets</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Build the workout first. Set-level methods stay attached to the set they change.
        </p>
      </div>
      <div className="space-y-3">
        {form.entries.map((entry, index) => {
          const methodBlock = form.methodBlocks.find((block) =>
            block.memberClientIds.includes(entry.clientId),
          );
          const methodPosition = methodBlock?.memberClientIds.indexOf(entry.clientId) ?? -1;
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
            <Card
              key={entry.clientId}
              className={`space-y-4 bg-card p-4 ${
                methodBlock ? "border-indigo-400/35" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  Movement {index + 1}
                  {methodBlock ? (
                    <Badge
                      variant="outline"
                      className="border-indigo-400/30 text-[10px] text-indigo-300"
                    >
                      {methodBlock.methodName} · {String.fromCharCode(65 + methodPosition)}
                    </Badge>
                  ) : null}
                </h3>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveEntry(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move movement ${index + 1} up`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveEntry(index, 1)}
                    disabled={index === form.entries.length - 1}
                    aria-label={`Move movement ${index + 1} down`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
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
              </div>
              <Field label="Movement">
                <div className="flex gap-2">
                  <MovementPicker
                    value={entry.exercise}
                    exercises={libraryExercises}
                    favoriteNames={favoriteExercises}
                    recentNames={recentExerciseNames}
                    onChange={(name) => {
                      const selected = libraryExercises.find((exercise) => exercise.name === name);
                      const selectedProfile = getMovementMetricProfile({
                        workoutType: selected?.workoutType ?? "Other",
                        movement: name,
                        defaultMetric: selected?.metric,
                      });
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
                      updateEntry(
                        index,
                        "distanceUnit",
                        selectedProfile === "mobility_position"
                          ? "cm"
                          : selectedProfile === "carry"
                            ? "m"
                            : selectedProfile === "time"
                              ? "km"
                              : "",
                      );
                      updateEntry(
                        index,
                        "climbingTrackingMode",
                        selectedProfile === "climbing" ? "Problems / routes" : "",
                      );
                      updateEntry(index, "setRows", [blankSet()]);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    disabled={!entry.exercise}
                    onClick={() => toggleFavoriteExercise(entry.exercise)}
                    aria-label={
                      favoriteExercises.some(
                        (item) => item.toLowerCase() === entry.exercise.toLowerCase(),
                      )
                        ? `Remove ${entry.exercise} from favourites`
                        : `Add ${entry.exercise} to favourites`
                    }
                  >
                    <Star
                      className={`h-4 w-4 ${
                        favoriteExercises.some(
                          (item) => item.toLowerCase() === entry.exercise.toLowerCase(),
                        )
                          ? "fill-amber-400 text-amber-400"
                          : ""
                      }`}
                    />
                  </Button>
                </div>
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
                <div className="space-y-3">
                  <SetRowsEditor
                    rows={entry.setRows}
                    usesLoad={profileUsesLoad(profile)}
                    setMethods={setMethods}
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
                    onAddMethod={(setIndex, method) => addSetMethod(index, setIndex, method)}
                    onAddSegment={(setIndex) => addSetSegment(index, setIndex)}
                    onUpdateSegment={(setIndex, segmentIndex, key, value) =>
                      updateSetSegment(index, setIndex, segmentIndex, key, value)
                    }
                    onRemoveSegment={(setIndex, segmentIndex) =>
                      removeSetSegment(index, setIndex, segmentIndex)
                    }
                    onRemoveMethod={(setIndex) => updateSet(index, setIndex, "method", undefined)}
                  />
                  {profile === "reps" ? (
                    <div className="grid gap-3 rounded-lg border border-border bg-secondary/20 p-3 sm:grid-cols-3">
                      <Field label="Progression">
                        <Input
                          value={entry.progressionLevel}
                          onChange={(event) =>
                            updateEntry(index, "progressionLevel", event.target.value)
                          }
                          placeholder="Strict, assisted, variation..."
                        />
                      </Field>
                      <Field label="Assistance">
                        <SimpleSelect
                          value={entry.assistanceType}
                          onChange={(value) => updateEntry(index, "assistanceType", value)}
                          options={lib.data?.assistanceTypes ?? []}
                        />
                      </Field>
                      <Field label="Assistance detail">
                        <Input
                          value={entry.assistanceDetail}
                          onChange={(event) =>
                            updateEntry(index, "assistanceDetail", event.target.value)
                          }
                          placeholder="Band, counterweight..."
                        />
                      </Field>
                    </div>
                  ) : null}
                </div>
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

      <Card className="space-y-3 border-border bg-card p-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Layers3 className="h-4 w-4 text-indigo-300" /> 2. Add advanced methods
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional. Choose whether the method joins movements or changes one set.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex min-h-24 flex-col justify-between gap-3 rounded-lg border border-border bg-secondary/20 p-3">
            <div>
              <p className="text-sm font-medium">Across movements</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Supersets, circuits, EDT and Tabata.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setMethodBlockEditor({ mode: "create" })}
              disabled={workoutEntries.length < 1 || blockMethods.length === 0}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add grouped or timed method
            </Button>
          </div>
          <div className="flex min-h-24 flex-col justify-between gap-3 rounded-lg border border-border bg-secondary/20 p-3">
            <div>
              <p className="text-sm font-medium">Within a set</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Drop sets, clusters, rest-pause, pyramids, eccentrics, negatives and more.
              </p>
            </div>
            <p className="text-xs font-medium text-fuchsia-200">
              Use “Set method” beneath the set it applies to.
            </p>
          </div>
        </div>

        {methods.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading available methods…</p>
        ) : form.methodBlocks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            {workoutEntries.length
              ? "No grouped or timed method added."
              : "Add a movement before creating a grouped or timed method."}
          </p>
        ) : (
          <div className="space-y-2">
            {form.methodBlocks.map((block) => {
              const movementNames = block.memberClientIds
                .map((id) => form.entries.find((entry) => entry.clientId === id)?.exercise)
                .filter(Boolean);
              return (
                <div
                  key={block.id}
                  className="flex flex-col gap-3 rounded-lg border border-indigo-400/25 bg-indigo-400/[0.05] p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{block.methodName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {block.family === "timed_density"
                        ? [
                            movementNames.join(" → "),
                            block.blockDurationMinutes
                              ? `${block.blockDurationMinutes} min block`
                              : "",
                            block.workIntervalSeconds ? `${block.workIntervalSeconds}s work` : "",
                            block.restIntervalSeconds ? `${block.restIntervalSeconds}s rest` : "",
                            block.completedRounds
                              ? `${block.completedRounds}/${block.rounds || "—"} rounds done`
                              : block.rounds
                                ? `${block.rounds} rounds planned`
                                : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : `${movementNames.join(" → ")} · ${block.rounds || "—"} rounds · ${block.restBetweenRoundsSeconds || "0"}s between rounds`}
                    </p>
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMethodBlockEditor({ mode: "edit", blockId: block.id })}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMethodBlock(block.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2">
        <Label className="text-sm">Completed</Label>
        <Switch checked={form.completed} onCheckedChange={(v) => update("completed", v)} />
      </div>

      <Button
        onClick={() => setFinishSummaryOpen(true)}
        disabled={!canSubmit}
        className="h-12 w-full text-base font-semibold"
        style={{ backgroundImage: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
      >
        <CircleCheck className="mr-1.5 h-5 w-5" />
        {editingSessionId ? "Review correction" : "Review and finish"}
      </Button>
      {incompleteSetMethod ? (
        <p className="text-center text-xs text-amber-300">
          Add load and reps to every segment before finishing.
        </p>
      ) : null}
      {hasDraftContent && !editingSessionId ? (
        <Button
          type="button"
          variant="ghost"
          className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setDiscardDraftOpen(true)}
        >
          <X className="mr-1.5 h-4 w-4" /> Cancel workout
        </Button>
      ) : null}

      <Dialog
        open={finishSummaryOpen}
        onOpenChange={(open) => !mutate.isPending && setFinishSummaryOpen(open)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSessionId ? "Finish corrected workout?" : "Finish this workout?"}
            </DialogTitle>
            <DialogDescription>
              Check the movements and recorded work before saving the completed session.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Location</p>
              <p className="mt-1 truncate text-sm font-semibold">{selectedLocation?.name ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Movements
              </p>
              <p className="mt-1 text-sm font-semibold">{workoutEntries.length}</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sets</p>
              <p className="mt-1 text-sm font-semibold">{totalRecordedSets || "—"}</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Methods</p>
              <p className="mt-1 text-sm font-semibold">{totalMethods || "—"}</p>
            </div>
          </div>

          <div className="space-y-2">
            {workoutEntries.map((entry, index) => (
              <div key={entry.clientId} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{entry.exercise}</p>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {index + 1}
                  </Badge>
                </div>
                {form.methodBlocks.find((block) =>
                  block.memberClientIds.includes(entry.clientId),
                ) ? (
                  <p className="mt-1 text-[11px] font-medium text-indigo-300">
                    {
                      form.methodBlocks.find((block) =>
                        block.memberClientIds.includes(entry.clientId),
                      )?.methodName
                    }
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">{workoutEntrySummary(entry)}</p>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={mutate.isPending}
              onClick={() => setFinishSummaryOpen(false)}
            >
              Keep editing
            </Button>
            <Button type="button" disabled={mutate.isPending} onClick={() => mutate.mutate()}>
              {mutate.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CircleCheck className="mr-1.5 h-4 w-4" />
              )}
              {editingSessionId ? "Save correction" : "Finish workout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MethodBlockDialog
        state={methodBlockEditor}
        methods={blockMethods}
        entries={form.entries}
        blocks={form.methodBlocks}
        onClose={() => setMethodBlockEditor({ mode: "closed" })}
        onSave={saveMethodBlock}
      />

      <AlertDialog open={discardDraftOpen} onOpenChange={setDiscardDraftOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this workout?</AlertDialogTitle>
            <AlertDialogDescription>
              The unfinished draft, including its movements, sets and methods, will be permanently
              cleared. Completed workouts will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep workout</AlertDialogCancel>
            <AlertDialogAction onClick={discardDraft}>Cancel workout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingRecentSession)}
        onOpenChange={(open) => !open && setPendingRecentSession(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace this workout?</AlertDialogTitle>
            <AlertDialogDescription>
              Loading the recent workout will replace the movements and set targets currently in
              your draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current workout</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRecentSession && loadRecentSession(pendingRecentSession)}
            >
              Load recent workout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function numberConfig(method: TrainingMethod | undefined, key: string, fallback: number) {
  const value = Number(method?.defaultConfig[key]);
  return Number.isFinite(value) ? String(value) : String(fallback);
}

function optionalNumberConfig(method: TrainingMethod | undefined, key: string) {
  const value = Number(method?.defaultConfig[key]);
  return Number.isFinite(value) ? String(value) : "";
}

function blockMinutesConfig(method: TrainingMethod | undefined) {
  const explicit = optionalNumberConfig(method, "block_minutes");
  if (explicit) return explicit;
  const rounds = Number(method?.defaultConfig.rounds);
  const work = Number(method?.defaultConfig.work_seconds);
  const rest = Number(method?.defaultConfig.rest_seconds);
  const minutes = (rounds * (work + rest)) / 60;
  return Number.isFinite(minutes) && minutes > 0 ? String(minutes) : "";
}

function methodMovementCount(method: TrainingMethod | undefined) {
  const fallback = method?.family === "timed_density" ? 1 : 2;
  return Math.max(fallback, Number(method?.defaultConfig.movement_count) || fallback);
}

function methodUsesExactMovementCount(method: TrainingMethod | undefined) {
  return ["superset", "tri_set", "edt", "tabata"].includes(method?.systemKey ?? "");
}

function methodSupportsMovementCount(method: TrainingMethod, movementCount: number) {
  const requiredCount = methodMovementCount(method);
  return methodUsesExactMovementCount(method)
    ? movementCount === requiredCount
    : movementCount >= requiredCount;
}

function defaultBlockMethod(methods: TrainingMethod[], movementCount: number) {
  const preferredSystemKey =
    movementCount === 1 ? "tabata" : movementCount === 2 ? "superset" : null;
  return (
    methods.find(
      (method) =>
        method.systemKey === preferredSystemKey &&
        methodSupportsMovementCount(method, movementCount),
    ) ??
    methods.find((method) => methodSupportsMovementCount(method, movementCount)) ??
    methods[0]
  );
}

function MethodBlockDialog({
  state,
  methods,
  entries,
  blocks,
  onClose,
  onSave,
}: {
  state: MethodBlockEditorState;
  methods: TrainingMethod[];
  entries: FormState[];
  blocks: WorkoutMethodBlockState[];
  onClose: () => void;
  onSave: (block: WorkoutMethodBlockState) => void;
}) {
  const namedEntries = entries.filter((entry) => entry.exercise.trim());
  const existing =
    state.mode === "edit" ? blocks.find((block) => block.id === state.blockId) : undefined;
  const initialMethod =
    methods.find((method) => method.id === existing?.trainingMethodId) ??
    defaultBlockMethod(methods, namedEntries.length);
  const [methodId, setMethodId] = useState(initialMethod?.id ?? "");
  const [memberClientIds, setMemberClientIds] = useState<string[]>(existing?.memberClientIds ?? []);
  const [rounds, setRounds] = useState(
    existing?.rounds ??
      (initialMethod?.family === "timed_density"
        ? optionalNumberConfig(initialMethod, "rounds")
        : numberConfig(initialMethod, "rounds", 3)),
  );
  const [restBetweenMovementsSeconds, setRestBetweenMovementsSeconds] = useState(
    existing?.restBetweenMovementsSeconds ??
      numberConfig(initialMethod, "rest_between_movements_seconds", 0),
  );
  const [restBetweenRoundsSeconds, setRestBetweenRoundsSeconds] = useState(
    existing?.restBetweenRoundsSeconds ??
      numberConfig(initialMethod, "rest_between_rounds_seconds", 90),
  );
  const [blockDurationMinutes, setBlockDurationMinutes] = useState(
    existing?.blockDurationMinutes ?? blockMinutesConfig(initialMethod),
  );
  const [workIntervalSeconds, setWorkIntervalSeconds] = useState(
    existing?.workIntervalSeconds ?? optionalNumberConfig(initialMethod, "work_seconds"),
  );
  const [restIntervalSeconds, setRestIntervalSeconds] = useState(
    existing?.restIntervalSeconds ?? optionalNumberConfig(initialMethod, "rest_seconds"),
  );
  const [completedRounds, setCompletedRounds] = useState(existing?.completedRounds ?? "");

  useEffect(() => {
    const block =
      state.mode === "edit" ? blocks.find((item) => item.id === state.blockId) : undefined;
    const method =
      methods.find((item) => item.id === block?.trainingMethodId) ??
      defaultBlockMethod(methods, namedEntries.length);
    setMethodId(method?.id ?? "");
    setMemberClientIds(block?.memberClientIds ?? []);
    setRounds(
      block?.rounds ??
        (method?.family === "timed_density"
          ? optionalNumberConfig(method, "rounds")
          : numberConfig(method, "rounds", 3)),
    );
    setRestBetweenMovementsSeconds(
      block?.restBetweenMovementsSeconds ??
        numberConfig(method, "rest_between_movements_seconds", 0),
    );
    setRestBetweenRoundsSeconds(
      block?.restBetweenRoundsSeconds ?? numberConfig(method, "rest_between_rounds_seconds", 90),
    );
    setBlockDurationMinutes(block?.blockDurationMinutes ?? blockMinutesConfig(method));
    setWorkIntervalSeconds(
      block?.workIntervalSeconds ?? optionalNumberConfig(method, "work_seconds"),
    );
    setRestIntervalSeconds(
      block?.restIntervalSeconds ?? optionalNumberConfig(method, "rest_seconds"),
    );
    setCompletedRounds(block?.completedRounds ?? "");
  }, [blocks, methods, namedEntries.length, state]);

  const selectedMethod = methods.find((method) => method.id === methodId);
  const isTimedDensity = selectedMethod?.family === "timed_density";
  const requiredCount = methodMovementCount(selectedMethod);
  const exactCount = methodUsesExactMovementCount(selectedMethod);
  const minimumCount = requiredCount;
  const selectionValid = exactCount
    ? memberClientIds.length === requiredCount
    : memberClientIds.length >= minimumCount;
  const usedElsewhere = new Set(
    blocks.filter((block) => block.id !== existing?.id).flatMap((block) => block.memberClientIds),
  );
  const timedFieldsValid =
    !isTimedDensity ||
    (selectedMethod?.systemKey === "tabata"
      ? Boolean(rounds && workIntervalSeconds && restIntervalSeconds)
      : Boolean(blockDurationMinutes));
  const completedRoundsValid =
    !completedRounds || !rounds || Number(completedRounds) <= Number(rounds);

  const selectMethod = (nextMethodId: string) => {
    const method = methods.find((item) => item.id === nextMethodId);
    setMethodId(nextMethodId);
    setMemberClientIds([]);
    setRounds(
      method?.family === "timed_density"
        ? optionalNumberConfig(method, "rounds")
        : numberConfig(method, "rounds", 3),
    );
    setRestBetweenMovementsSeconds(
      method?.family === "timed_density"
        ? ""
        : numberConfig(method, "rest_between_movements_seconds", 0),
    );
    setRestBetweenRoundsSeconds(
      method?.family === "timed_density"
        ? ""
        : numberConfig(method, "rest_between_rounds_seconds", 90),
    );
    setBlockDurationMinutes(blockMinutesConfig(method));
    setWorkIntervalSeconds(optionalNumberConfig(method, "work_seconds"));
    setRestIntervalSeconds(optionalNumberConfig(method, "rest_seconds"));
    setCompletedRounds("");
  };

  return (
    <Dialog open={state.mode !== "closed"} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {state.mode === "edit" ? "Edit training method" : "Add training method"}
          </DialogTitle>
          <DialogDescription>
            Choose the movements and method defaults. Every movement keeps its own sets, load, reps,
            and RPE.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Method">
            <Select value={methodId} onValueChange={selectMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a method" />
              </SelectTrigger>
              <SelectContent>
                {methods.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    {method.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div>
            <Label>Movements in order</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              {exactCount
                ? `Choose exactly ${requiredCount}.`
                : `Choose at least ${minimumCount}. Their workout order becomes A, B, C…`}
            </p>
            <div className="mt-2 space-y-2">
              {namedEntries.map((entry, index) => {
                const checked = memberClientIds.includes(entry.clientId);
                const unavailable = usedElsewhere.has(entry.clientId);
                const atCapacity =
                  exactCount && memberClientIds.length >= requiredCount && !checked;
                return (
                  <label
                    key={entry.clientId}
                    className={`flex items-center gap-3 rounded-lg border p-3 ${
                      checked ? "border-indigo-400/40 bg-indigo-400/[0.06]" : "border-border"
                    } ${unavailable ? "opacity-50" : "cursor-pointer"}`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={unavailable || atCapacity}
                      onCheckedChange={(nextChecked) =>
                        setMemberClientIds((current) =>
                          nextChecked
                            ? [...current, entry.clientId]
                            : current.filter((id) => id !== entry.clientId),
                        )
                      }
                      aria-label={`Include ${entry.exercise}`}
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      {index + 1}. {entry.exercise}
                    </span>
                    {unavailable ? (
                      <span className="text-[10px] uppercase text-muted-foreground">
                        In another method
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>

          {isTimedDensity ? (
            <div className="space-y-3 rounded-lg border border-indigo-400/20 bg-indigo-400/[0.04] p-3">
              <p className="text-xs text-muted-foreground">
                Record the planned timing now and completed rounds when you finish. Sets and reps
                remain the completed workload.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Block duration (min)">
                  <Input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={blockDurationMinutes}
                    placeholder={selectedMethod?.systemKey === "tabata" ? "4" : "15"}
                    onChange={(event) => setBlockDurationMinutes(event.target.value)}
                  />
                </Field>
                <Field label="Planned rounds">
                  <Input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={rounds}
                    placeholder={selectedMethod?.systemKey === "edt" ? "Optional" : "8"}
                    onChange={(event) => setRounds(event.target.value)}
                  />
                </Field>
                <Field label="Work interval (sec)">
                  <Input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={workIntervalSeconds}
                    placeholder={selectedMethod?.systemKey === "edt" ? "Optional" : "20"}
                    onChange={(event) => setWorkIntervalSeconds(event.target.value)}
                  />
                </Field>
                <Field label="Rest interval (sec)">
                  <Input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={restIntervalSeconds}
                    placeholder={selectedMethod?.systemKey === "edt" ? "Optional" : "10"}
                    onChange={(event) => setRestIntervalSeconds(event.target.value)}
                  />
                </Field>
              </div>
              <Field label="Completed rounds (optional)">
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={completedRounds}
                  onChange={(event) => setCompletedRounds(event.target.value)}
                />
                {!completedRoundsValid ? (
                  <p className="mt-1 text-[11px] text-destructive">
                    Completed rounds cannot exceed planned rounds.
                  </p>
                ) : null}
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Rounds">
                <Input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={rounds}
                  onChange={(event) => setRounds(event.target.value)}
                />
              </Field>
              <Field label="Between moves (sec)">
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={restBetweenMovementsSeconds}
                  onChange={(event) => setRestBetweenMovementsSeconds(event.target.value)}
                />
              </Field>
              <Field label="Between rounds (sec)">
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={restBetweenRoundsSeconds}
                  onChange={(event) => setRestBetweenRoundsSeconds(event.target.value)}
                />
              </Field>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              !selectedMethod ||
              !selectionValid ||
              !timedFieldsValid ||
              !completedRoundsValid ||
              (!isTimedDensity && !rounds)
            }
            onClick={() => {
              if (!selectedMethod) return;
              const entryOrder = new Map(entries.map((entry, index) => [entry.clientId, index]));
              onSave({
                id: existing?.id ?? newClientId("method"),
                trainingMethodId: selectedMethod.id,
                methodName: selectedMethod.name,
                family: selectedMethod.family as "exercise_group" | "timed_density",
                memberClientIds: [...memberClientIds].sort(
                  (left, right) => (entryOrder.get(left) ?? 0) - (entryOrder.get(right) ?? 0),
                ),
                rounds,
                restBetweenMovementsSeconds,
                restBetweenRoundsSeconds,
                blockDurationMinutes,
                workIntervalSeconds,
                restIntervalSeconds,
                completedRounds,
                config: {
                  ...selectedMethod.defaultConfig,
                  movement_count: memberClientIds.length,
                  rounds: Number(rounds),
                  rest_between_movements_seconds: Number(restBetweenMovementsSeconds),
                  rest_between_rounds_seconds: Number(restBetweenRoundsSeconds),
                  block_minutes: Number(blockDurationMinutes),
                  work_seconds: Number(workIntervalSeconds),
                  rest_seconds: Number(restIntervalSeconds),
                  completed_rounds: Number(completedRounds),
                },
              });
            }}
          >
            Save method
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementPicker({
  value,
  exercises,
  favoriteNames,
  recentNames,
  onChange,
}: {
  value: string;
  exercises: { name: string; workoutType: string; equipment?: string }[];
  favoriteNames: string[];
  recentNames: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const favoriteSet = new Set(favoriteNames.map((name) => name.toLowerCase()));
  const recentSet = new Set(recentNames.map((name) => name.toLowerCase()));
  const favoriteExercises = exercises.filter((exercise) =>
    favoriteSet.has(exercise.name.toLowerCase()),
  );
  const recentExercises = exercises.filter(
    (exercise) =>
      recentSet.has(exercise.name.toLowerCase()) && !favoriteSet.has(exercise.name.toLowerCase()),
  );
  const otherExercises = exercises.filter(
    (exercise) =>
      !favoriteSet.has(exercise.name.toLowerCase()) && !recentSet.has(exercise.name.toLowerCase()),
  );
  const groups = [
    { label: "Favourites", exercises: favoriteExercises },
    { label: "Recent", exercises: recentExercises },
    { label: "All movements", exercises: otherExercises },
  ].filter((group) => group.exercises.length > 0);

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
            {groups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.exercises.map((exercise) => (
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
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function setMethodKind(method: WorkoutSetMethodState) {
  const key = method.systemKey ?? String(method.config.system_key ?? "");
  const name = method.methodName.toLowerCase();
  if (key === "cluster_set" || name.includes("cluster")) return "cluster";
  if (key === "rest_pause" || name.includes("rest-pause") || name.includes("rest pause")) {
    return "rest-pause";
  }
  if (key === "rep_targeting" || name.includes("rep target")) return "rep-target";
  if (key === "partial_reps" || name.includes("partial")) return "partial";
  if (key === "drop_set" || name.includes("drop") || name.includes("strip")) return "drop";
  if (key === "eccentrics" || name.includes("eccentric")) return "eccentric";
  if (key === "pyramid" || name.includes("pyramid")) return "pyramid";
  if (key === "negatives" || name.includes("negative")) return "negative";
  return "segment";
}

function setMethodCopy(method: WorkoutSetMethodState) {
  const kind = setMethodKind(method);
  if (kind === "cluster") {
    return { noun: "Cluster", add: "Add another cluster", intro: "Cluster 1 uses the main set." };
  }
  if (kind === "rest-pause") {
    return {
      noun: "Effort",
      add: "Add another effort",
      intro: "Effort 1 uses the main set before the first short pause.",
    };
  }
  if (kind === "drop") {
    return { noun: "Drop", add: "Add another drop", intro: "Segment 1 uses the main set." };
  }
  if (kind === "rep-target") {
    return {
      noun: "Effort",
      add: "Add another effort",
      intro: "Effort 1 uses the main set. Stop when the target is reached.",
    };
  }
  if (kind === "partial") {
    return {
      noun: "Partial",
      add: "Add another partial effort",
      intro: "The main set range is selectable; added efforts default to partial.",
    };
  }
  if (kind === "eccentric") {
    return {
      noun: "Eccentric effort",
      add: "Add another eccentric effort",
      intro: "Effort 1 uses the main set with a controlled lowering phase.",
    };
  }
  if (kind === "pyramid") {
    return {
      noun: "Step",
      add: "Add another pyramid step",
      intro: "Step 1 uses the main set; adjust load and reps at each step.",
    };
  }
  if (kind === "negative") {
    return {
      noun: "Negative",
      add: "Add another negative",
      intro: "Rep 1 uses the main set; record each controlled lowering effort.",
    };
  }
  return { noun: "Segment", add: "Add another segment", intro: "Segment 1 uses the main set." };
}

function SetRowsEditor({
  rows,
  usesLoad,
  setMethods,
  previousWorkout,
  onChange,
  onCopyPrevious,
  onRepeat,
  onAddBlank,
  onRemove,
  onAddMethod,
  onAddSegment,
  onUpdateSegment,
  onRemoveSegment,
  onRemoveMethod,
}: {
  rows: WorkoutSetState[];
  usesLoad: boolean;
  setMethods: TrainingMethod[];
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
  onAddMethod: (setIndex: number, method: TrainingMethod) => void;
  onAddSegment: (setIndex: number) => void;
  onUpdateSegment: <K extends keyof WorkoutSetSegmentState>(
    setIndex: number,
    segmentIndex: number,
    key: K,
    value: WorkoutSetSegmentState[K],
  ) => void;
  onRemoveSegment: (setIndex: number, segmentIndex: number) => void;
  onRemoveMethod: (setIndex: number) => void;
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
        <div key={setIndex} className="space-y-2">
          <div
            className={`rounded-md border border-border/70 bg-background p-2 sm:grid sm:items-center sm:gap-2 sm:border-0 sm:bg-transparent sm:p-0 ${
              usesLoad ? "sm:grid-cols-[32px_1fr_1fr_1fr_32px]" : "sm:grid-cols-[32px_1fr_1fr_32px]"
            }`}
          >
            <div className="mb-2 flex items-center justify-between sm:hidden">
              <span className="text-xs font-semibold text-muted-foreground">
                Set {setIndex + 1}
              </span>
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

          {usesLoad && set.method ? (
            <div className="ml-0 rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/[0.05] p-3 sm:ml-10">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-fuchsia-200">{set.method.methodName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {setMethodCopy(set.method).intro}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveMethod(setIndex)}
                >
                  Remove method
                </Button>
              </div>
              {setMethodKind(set.method) === "rep-target" ? (
                <div className="mt-3 rounded-md border border-fuchsia-400/20 bg-background/60 px-3 py-2">
                  {(() => {
                    const target = Number(set.method?.config.target_reps) || 0;
                    const completed =
                      (Number(set.reps) || 0) +
                      (set.method?.segments.reduce(
                        (total, segment) => total + (Number(segment.reps) || 0),
                        0,
                      ) ?? 0);
                    const remaining = Math.max(0, target - completed);
                    return (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium">
                          {completed} / {target} target reps
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {remaining > 0 ? `${remaining} remaining` : "Target reached"}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ) : null}
              {setMethodKind(set.method) === "partial" ? (
                <div className="mt-3 max-w-44">
                  <Field label="Main set range">
                    <Select
                      value={String(set.method.config.base_range_of_motion ?? "full")}
                      onValueChange={(value) =>
                        onChange(setIndex, "method", {
                          ...set.method!,
                          config: { ...set.method!.config, base_range_of_motion: value },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              ) : null}
              <div className="mt-3 space-y-2">
                {set.method.segments.map((segment, segmentIndex) => (
                  <div
                    key={segmentIndex}
                    className="rounded-md border border-border/70 bg-background/60 p-2"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium">
                        {setMethodCopy(set.method!).noun} {segmentIndex + 2}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => onRemoveSegment(setIndex, segmentIndex)}
                        aria-label={`Remove ${setMethodCopy(set.method!).noun.toLowerCase()} ${segmentIndex + 2} from set ${setIndex + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="kg">
                        <Input
                          inputMode="decimal"
                          value={segment.weight}
                          onChange={(event) =>
                            onUpdateSegment(setIndex, segmentIndex, "weight", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Reps">
                        <Input
                          inputMode="numeric"
                          value={segment.reps}
                          onChange={(event) =>
                            onUpdateSegment(setIndex, segmentIndex, "reps", event.target.value)
                          }
                        />
                      </Field>
                      <Field label="RPE">
                        <Input
                          inputMode="decimal"
                          value={segment.rpe}
                          onChange={(event) =>
                            onUpdateSegment(setIndex, segmentIndex, "rpe", event.target.value)
                          }
                        />
                      </Field>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Field label="Rest after (sec)">
                        <Input
                          inputMode="numeric"
                          value={segment.restAfterSeconds}
                          onChange={(event) =>
                            onUpdateSegment(
                              setIndex,
                              segmentIndex,
                              "restAfterSeconds",
                              event.target.value,
                            )
                          }
                        />
                      </Field>
                      <Field label="Range">
                        <Select
                          value={segment.rangeOfMotion}
                          onValueChange={(value) =>
                            onUpdateSegment(setIndex, segmentIndex, "rangeOfMotion", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Full</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => onAddSegment(setIndex)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> {setMethodCopy(set.method).add}
              </Button>
            </div>
          ) : usesLoad && setMethods.length ? (
            <div className="ml-0 sm:ml-10 sm:max-w-xs">
              <Select
                onValueChange={(methodId) => {
                  const method = setMethods.find((item) => item.id === methodId);
                  if (method) onAddMethod(setIndex, method);
                }}
              >
                <SelectTrigger className="border-dashed border-fuchsia-400/25 text-fuchsia-200">
                  <Layers3 className="mr-2 h-3.5 w-3.5" />
                  <SelectValue placeholder="Set method (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {setMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
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
        <div className="grid gap-3 sm:grid-cols-4">
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
          <Field label="Unit">
            <SimpleSelect
              value={form.distanceUnit}
              onChange={(value) => update("distanceUnit", value)}
              options={["km", "mi", "m"]}
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

  if (profile === "duration") {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Minutes">
            <Input
              inputMode="numeric"
              value={form.duration}
              onChange={(event) => update("duration", event.target.value)}
            />
          </Field>
          <Field label="Intensity">
            <SimpleSelect
              value={form.intensity}
              onChange={(value) => update("intensity", value)}
              options={intensities}
            />
          </Field>
          <Field label="RPE">
            <Input
              inputMode="decimal"
              value={form.rpe}
              onChange={(event) => update("rpe", event.target.value)}
            />
          </Field>
        </div>
        <Field label="Detail">
          <Input
            value={form.detail}
            onChange={(event) => update("detail", event.target.value)}
            placeholder="Zone, class focus, sequence..."
          />
        </Field>
      </div>
    );
  }

  if (profile === "carry") {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className="grid gap-3 sm:grid-cols-5">
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
          <Field label="Unit">
            <SimpleSelect
              value={form.distanceUnit}
              onChange={(value) => update("distanceUnit", value)}
              options={["m", "yd", "km"]}
            />
          </Field>
          <Field label="Minutes">
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
        <div className={`grid gap-3 ${usesLoad ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
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
          {usesLoad ? (
            <Field label="Load (kg)">
              <Input
                inputMode="decimal"
                value={form.weight}
                onChange={(event) => update("weight", event.target.value)}
              />
            </Field>
          ) : null}
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

  if (profile === "climbing") {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tracking mode">
            <SimpleSelect
              value={form.climbingTrackingMode}
              onChange={(value) => update("climbingTrackingMode", value)}
              options={["Time only", "Problems / routes"]}
            />
          </Field>
          <Field label="Minutes">
            <Input
              inputMode="numeric"
              value={form.duration}
              onChange={(event) => update("duration", event.target.value)}
            />
          </Field>
          {form.climbingTrackingMode !== "Time only" ? (
            <Field label="Problems / routes">
              <Input
                inputMode="numeric"
                value={form.climbingBoulders}
                onChange={(event) => update("climbingBoulders", event.target.value)}
              />
            </Field>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Max grade">
            <Input
              value={form.climbingMaxGrade}
              onChange={(event) => update("climbingMaxGrade", event.target.value)}
              placeholder="V5, 6b+, 7A..."
            />
          </Field>
          <Field label="Gradient">
            <SimpleSelect
              value={form.climbingGradient}
              onChange={(value) => update("climbingGradient", value)}
              options={BOARD_GRADIENTS}
            />
          </Field>
          <Field label="Intensity">
            <SimpleSelect
              value={form.intensity}
              onChange={(value) => update("intensity", value)}
              options={intensities}
            />
          </Field>
          <Field label="RPE">
            <Input
              inputMode="decimal"
              value={form.rpe}
              onChange={(event) => update("rpe", event.target.value)}
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
