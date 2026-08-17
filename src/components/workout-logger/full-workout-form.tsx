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
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkoutLifecycleBadge } from "@/components/workout-lifecycle-badge";
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
  addWorkoutSessionClient,
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
  profileSupportsAdvancedMethods,
  profileUsesLoad,
  profileUsesStandardSets,
} from "@/lib/movement-metrics";
import {
  CLIMBING_TRACKING_MODES,
  climbingMetricIssue,
  MAX_CLIMBING_MINUTES,
  supportsClimbingGradient,
} from "@/lib/climbing-metrics";
import {
  readWorkoutPlanDraft,
  WORKOUT_PLAN_DRAFT_KEY,
  WORKOUT_TRAINING_LOCATION_KEY,
  type RecentWorkoutLog,
  type WorkoutPlanDraft,
} from "@/lib/workout-plan";
import { workoutPlanLifecycleState } from "@/lib/workout-lifecycle";
import {
  listTrainingMethodsClient,
  type TrainingMethod,
} from "@/lib/supabase-training-methods.browser";
import {
  BLOCK_HEIGHT_OPTIONS,
  blockHeightOption,
  formatPositionMeasurementDirection,
} from "@/lib/position-measurements";
import { MethodBlockDialog } from "./method-block-dialog";
import type { LoadSemantics } from "@/lib/data-quality";
import {
  DateInput,
  DeleteConfirmDialog,
  Field,
  SimpleSelect,
  RecentList,
  type DeleteTarget,
  type RecentEntry,
} from "./form-bits";

const today = todayISO;
const SKILL_WORKOUT_TYPE = "Skills/Calisthenics";
const GRIP_WORKOUT_TYPE = "Grip";
const YOGA_WORKOUT_TYPE = "Yoga";
const CLIMBING_WORKOUT_TYPE = "Climbing";
const CLIMBING_WALL_EQUIPMENT_NAME = "Climbing wall";
const CLASS_WORKOUT_TYPE = "Class";
const MOBILITY_WORKOUT_TYPE = "Mobility/Flexibility";

function coerceExerciseEquipment(exercise: unknown) {
  if (!exercise || typeof exercise !== "object" || !("equipment" in exercise)) return "";
  const equipment = (exercise as { equipment?: unknown }).equipment;
  return typeof equipment === "string" ? equipment.toLowerCase() : "";
}

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
  positionMeasurementGuide?: string;
  positionMeasurementLabel?: string;
  positionMeasurementDirection?: string;
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

export type FormState = {
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
  technique: string;
  pain: string;
  gripStyle: string;
  gripLoadType: string;
  climbingTrackingMode: string;
  climbingHours: string;
  climbingBoulders: string;
  climbingMaxGrade: string;
  climbingGradient: string;
  loadSemantics: LoadSemantics | "";
  distance: string;
  distanceUnit: string;
  rounds: string;
  feel: string;
  height: string;
  positionMeasurementCm: string;
  positionMeasurementSetup: string;
  detail: string;
  setRows: WorkoutSetState[];
};

export type WorkoutMethodBlockState = {
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

export type MethodBlockEditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; blockId: string };

export type WorkoutSetState = {
  reps: string;
  weight: string;
  durationSeconds: string;
  rpe: string;
  completed: boolean;
  method?: WorkoutSetMethodState;
};

export type WorkoutSetSegmentState = {
  reps: string;
  weight: string;
  rpe: string;
  restAfterSeconds: string;
  rangeOfMotion: string;
};

export type WorkoutSetMethodState = {
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

function removeMovementFromMethodBlocks(
  methodBlocks: WorkoutMethodBlockState[],
  movementClientId: string,
) {
  return methodBlocks
    .map((block) => ({
      ...block,
      memberClientIds: block.memberClientIds.filter((id) => id !== movementClientId),
    }))
    .filter((block) =>
      block.family === "timed_density"
        ? block.memberClientIds.length >= 1
        : block.memberClientIds.length >= 2,
    );
}

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
  technique: "",
  pain: "",
  gripStyle: "",
  gripLoadType: "",
  climbingTrackingMode: "",
  climbingHours: "",
  climbingBoulders: "",
  climbingMaxGrade: "",
  climbingGradient: "",
  loadSemantics: "",
  distance: "",
  distanceUnit: "cm",
  rounds: "",
  feel: "",
  height: "",
  positionMeasurementCm: "",
  positionMeasurementSetup: "",
  detail: "",
  setRows: [],
});

const blankSet = (): WorkoutSetState => ({
  reps: "",
  weight: "",
  durationSeconds: "",
  rpe: "",
  completed: true,
});

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
    technique: entry.technique ?? "",
    pain: entry.pain ?? "",
    loadSemantics: entry.loadSemantics ?? "",
    positionMeasurementCm: String(entry.positionMeasurementCm ?? ""),
    positionMeasurementSetup: String(entry.positionMeasurementSetup ?? ""),
    clientId:
      typeof entry.clientId === "string" && entry.clientId
        ? entry.clientId
        : newClientId("movement"),
    setRows: entry.setRows.map((set) => ({
      ...set,
      durationSeconds: String(set.durationSeconds ?? ""),
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
    "positionMeasurementCm",
    "positionMeasurementSetup",
    "detail",
  ];
  return (
    stringFields.some((key) => Boolean(entry[key])) ||
    !entry.completed ||
    entry.setRows.some(
      (set) =>
        set.reps ||
        set.weight ||
        set.durationSeconds ||
        set.rpe ||
        !set.completed ||
        Boolean(set.method),
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
  if (
    log.setRows.length > 1 ||
    log.setRows.some((set) => set.method) ||
    (!log.sets && log.setRows.some((set) => set.durationSeconds))
  ) {
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
    durationSeconds: log.setRows[0]?.durationSeconds ?? log.holdSeconds,
    rpe: "",
    completed: true,
  }));
}

function setSummary(set: WorkoutSetState, usesLoad: boolean) {
  const load = usesLoad && set.weight ? `${set.weight} kg` : "";
  const reps = set.reps ? `${set.reps} reps` : "";
  const duration = set.durationSeconds ? `${set.durationSeconds}s` : "";
  const rpe = set.rpe ? `RPE ${set.rpe}` : "";
  const drops = set.method?.segments
    .map((segment) =>
      [segment.weight ? `${segment.weight} kg` : "", segment.reps ? `${segment.reps} reps` : ""]
        .filter(Boolean)
        .join(" × "),
    )
    .filter(Boolean);
  return (
    [
      load,
      reps,
      duration,
      rpe,
      drops?.length ? `${set.method?.methodName}: ${drops.join(" → ")}` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "No values recorded"
  );
}

function numericInputValue(value: unknown) {
  if (value == null) return 0;
  const match = String(value)
    .trim()
    .match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : 0;
}

function workoutEntrySummary(entry: FormState, profile: MetricProfile) {
  const sets = entry.setRows.filter(
    (set) => set.reps || set.weight || set.durationSeconds || set.rpe || set.method,
  );
  if (sets.length > 0) {
    const segments = sets.flatMap((set) => [
      { reps: set.reps, weight: set.weight },
      ...(set.method?.segments ?? []),
    ]);
    const reps = segments.reduce((total, set) => total + numericInputValue(set.reps), 0);
    const volume = sets.reduce(
      (total, set) =>
        total +
        [{ reps: set.reps, weight: set.weight }, ...(set.method?.segments ?? [])].reduce(
          (setTotal, segment) =>
            setTotal + numericInputValue(segment.weight) * numericInputValue(segment.reps),
          0,
        ),
      0,
    );
    const methodSegments = sets.reduce(
      (total, set) => total + (set.method?.segments.length ?? 0),
      0,
    );
    const holdSeconds = sets.map((set) => numericInputValue(set.durationSeconds));
    const recordedHolds = holdSeconds.filter((seconds) => seconds > 0);
    const totalHoldSeconds = recordedHolds.reduce((total, seconds) => total + seconds, 0);
    const isTimed = totalHoldSeconds > 0 && reps === 0;
    const isStaticDuration = ["hold", "grip", "mobility_position"].includes(profile);
    const assistance = [entry.assistanceType, entry.assistanceDetail].filter(Boolean).join(" · ");
    return [
      `${sets.length} ${
        isTimed
          ? isStaticDuration
            ? sets.length === 1
              ? "attempt"
              : "attempts"
            : sets.length === 1
              ? "interval"
              : "intervals"
          : sets.length === 1
            ? "set"
            : "sets"
      }`,
      methodSegments
        ? `${methodSegments} extra ${methodSegments === 1 ? "segment" : "segments"}`
        : "",
      reps > 0 ? `${reps} reps` : "",
      totalHoldSeconds > 0 && isStaticDuration
        ? recordedHolds.length > 1
          ? `${recordedHolds.map((seconds) => `${seconds}s`).join(" + ")} = ${totalHoldSeconds}s total hold`
          : `${totalHoldSeconds}s total hold`
        : "",
      totalHoldSeconds > 0 && !isStaticDuration
        ? recordedHolds.length > 1
          ? `${recordedHolds.map((seconds) => `${seconds}s`).join(" + ")} = ${totalHoldSeconds}s total time`
          : `${totalHoldSeconds}s`
        : "",
      volume > 0 ? `${Math.round(volume).toLocaleString()} kg volume` : "",
      entry.progressionLevel ? `Progression: ${entry.progressionLevel}` : "",
      assistance ? `Assistance: ${assistance}` : "",
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
      entry.positionMeasurementCm
        ? `${entry.positionMeasurementCm} cm${entry.positionMeasurementSetup ? ` · ${entry.positionMeasurementSetup}` : ""}`
        : "",
      entry.climbingBoulders ? `${entry.climbingBoulders} problems/routes` : "",
      entry.climbingMaxGrade ? `Grade ${entry.climbingMaxGrade}` : "",
      entry.climbingGradient ? entry.climbingGradient : "",
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
    technique: log.technique,
    pain: log.pain,
    distance: log.distance,
    distanceUnit: log.distanceUnit,
    rounds: log.rounds,
    feel: log.feel,
    height: log.height,
    positionMeasurementCm: log.positionMeasurementCm,
    positionMeasurementSetup: log.positionMeasurementSetup,
    detail: log.detail,
    climbingBoulders: log.climbingBoulders,
    climbingTrackingMode: log.climbingTrackingMode
      ? ["Hours", "Time only"].includes(log.climbingTrackingMode)
        ? "Time only"
        : "Problems / routes"
      : "",
    climbingMaxGrade: log.climbingMaxGrade,
    climbingGradient: supportsClimbingGradient(log.exercise) ? log.climbingGradient : "",
    loadSemantics: (log.loadSemantics ?? "") as LoadSemantics | "",
    setRows: setRowsFromRecentLog(log),
  };
}

function buildRecentSessionTemplates(
  logs: RecentWorkoutLog[],
  locationKind?: string,
  allowedExerciseNames?: Set<string>,
): RecentSessionTemplate[] {
  const completed = logs.filter(
    (log) =>
      log.completed &&
      log.exercise &&
      log.id &&
      (!allowedExerciseNames || allowedExerciseNames.has(log.exercise.toLowerCase())),
  );
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

type ClimbFormState = {
  date: string;
  trainingLocationId: string;
  movement: string;
  durationHours: string;
  durationMinutes: string;
  problemsOrRoutes: string;
  grade: string;
  gradient: string;
  rpe: string;
  notes: string;
};

const blankClimbForm = (): ClimbFormState => ({
  date: today(),
  trainingLocationId: "",
  movement: "Bouldering Session",
  durationHours: "",
  durationMinutes: "",
  problemsOrRoutes: "",
  grade: "",
  gradient: "",
  rpe: "",
  notes: "",
});

function wholeNumberOrZero(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (!/^\d+$/.test(trimmed)) return null;
  const number = Number(trimmed);
  return Number.isSafeInteger(number) ? number : null;
}

function climbDurationInMinutes(hours: string, minutes: string) {
  const parsedHours = wholeNumberOrZero(hours);
  const parsedMinutes = wholeNumberOrZero(minutes);
  if (parsedHours == null || parsedMinutes == null || parsedMinutes > 59) return null;
  return parsedHours * 60 + parsedMinutes;
}

function climbMovementLabel(movement: string) {
  if (movement === "Bouldering Session") return "Bouldering";
  if (movement === "Ropes/Belay") return "Ropes";
  return movement;
}

function climbCountLabel(movement: string) {
  if (movement === "Bouldering Session" || movement === "Kilter") return "Problems";
  if (movement === "Ropes/Belay") return "Routes";
  return "Problems / routes";
}

export function ClimbForm() {
  const qc = useQueryClient();
  const [form, setForm] = useState<ClimbFormState>(() => blankClimbForm());
  const [loadedSuggestionId, setLoadedSuggestionId] = useState<string | null>(null);
  const [loadedPlanTitle, setLoadedPlanTitle] = useState("");
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const library = useQuery({
    queryKey: ["library"],
    queryFn: getLibraryClient,
    staleTime: 5 * 60_000,
  });
  const locations = useQuery({
    queryKey: ["training-locations"],
    queryFn: getTrainingLocationsClient,
    staleTime: 5 * 60_000,
  });
  const nextPlans = useQuery({
    queryKey: ["next-suggested-workouts"],
    queryFn: getNextSuggestedWorkoutsClient,
    staleTime: 30_000,
  });
  const climbingPlans = (nextPlans.data ?? []).filter(
    (plan) => plan.movements.length === 1 && plan.movements[0]?.trackingMode === "climbing",
  );
  const climbingWallEquipmentId = library.data?.equipmentItems.find(
    (item) =>
      item.isActive &&
      item.name.trim().toLowerCase() === CLIMBING_WALL_EQUIPMENT_NAME.toLowerCase(),
  )?.id;
  const climbingLocations = useMemo(
    () =>
      climbingWallEquipmentId
        ? (locations.data ?? []).filter((location) =>
            location.equipmentItemIds.includes(climbingWallEquipmentId),
          )
        : [],
    [climbingWallEquipmentId, locations.data],
  );
  const selectedLocation = locations.data?.find(
    (location) => location.id === form.trainingLocationId,
  );
  const movementMeta = library.data?.exercises.find((exercise) => exercise.name === form.movement);
  const movementAvailable = Boolean(
    movementMeta?.availableLocationIds.includes(form.trainingLocationId),
  );
  const totalMinutes = climbDurationInMinutes(form.durationHours, form.durationMinutes);
  const trackingMode = form.problemsOrRoutes.trim() ? "Problems / routes" : "Time only";
  const climbingIssue =
    totalMinutes == null
      ? "Use whole hours and minutes, with minutes between 0 and 59."
      : climbingMetricIssue({
          minutes: String(totalMinutes),
          trackingMode,
          problemsOrRoutes: form.problemsOrRoutes,
        });
  const rpe = Number(form.rpe);
  const rpeIssue =
    form.rpe.trim() && (!Number.isFinite(rpe) || rpe < 1 || rpe > 10)
      ? "RPE must be between 1 and 10."
      : null;
  const validationIssue = climbingIssue ?? rpeIssue;
  const hasStartedMetrics = Boolean(
    form.durationHours || form.durationMinutes || form.problemsOrRoutes || form.rpe,
  );

  const update = <K extends keyof ClimbFormState>(key: K, value: ClimbFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const loadClimbingPlan = useCallback((draft: WorkoutPlanDraft) => {
    const movement = draft.movements[0];
    if (!movement || movement.trackingMode !== "climbing") return false;
    const duration = Math.max(0, Math.round(Number(movement.targets.durationMinutes) || 0));
    setForm((current) => ({
      ...current,
      trainingLocationId: draft.trainingLocationId ?? current.trainingLocationId,
      movement: CLIMBING_MOVEMENTS.includes(movement.exercise)
        ? movement.exercise
        : "Bouldering Session",
      durationHours: duration >= 60 ? String(Math.floor(duration / 60)) : "",
      durationMinutes: String(duration % 60),
      notes: movement.targets.detail,
    }));
    setLoadedSuggestionId(draft.suggestedWorkoutId ?? null);
    setLoadedPlanTitle(draft.title);
    return true;
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(WORKOUT_PLAN_DRAFT_KEY);
    const plan = readWorkoutPlanDraft(stored);
    if (!plan || !loadClimbingPlan(plan)) return;
    window.localStorage.removeItem(WORKOUT_PLAN_DRAFT_KEY);
    toast.message("Climbing plan loaded", {
      description: "The duration and automatic circuit instructions are ready in the Climb logger.",
    });
  }, [loadClimbingPlan]);

  const useSavedClimbingPlan = useMutation({
    mutationFn: async (plan: SavedWorkoutPlan) => {
      await updateSuggestedWorkoutStatusClient(plan.suggestedWorkoutId, "accepted");
      return plan;
    },
    onSuccess: (plan) => {
      loadClimbingPlan(plan);
      qc.invalidateQueries({ queryKey: ["next-suggested-workouts"] });
      qc.invalidateQueries({ queryKey: ["workout-lifecycle"] });
      toast.message("Climbing plan loaded");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const skipSavedClimbingPlan = useMutation({
    mutationFn: (id: string) => updateSuggestedWorkoutStatusClient(id, "skipped"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["next-suggested-workouts"] });
      qc.invalidateQueries({ queryKey: ["workout-lifecycle"] });
      toast.message("Climbing plan skipped");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!climbingLocations.length) {
      if (form.trainingLocationId && library.data && locations.data) {
        setForm((current) => ({ ...current, trainingLocationId: "" }));
      }
      return;
    }
    if (climbingLocations.some((location) => location.id === form.trainingLocationId)) return;
    const storedId = window.localStorage.getItem(WORKOUT_TRAINING_LOCATION_KEY);
    const selected =
      climbingLocations.find((location) => location.id === storedId) ??
      climbingLocations.find((location) => location.kind === "gym") ??
      climbingLocations[0];
    if (selected) {
      setForm((current) => ({ ...current, trainingLocationId: selected.id }));
    }
  }, [climbingLocations, form.trainingLocationId, library.data, locations.data]);

  const mutate = useMutation({
    mutationFn: () => {
      const duration = String(totalMinutes ?? "");
      return addWorkoutSessionClient({
        date: form.date,
        title: form.movement,
        trainingLocationId: form.trainingLocationId,
        duration,
        intensity: "",
        rpe: form.rpe,
        completed: true,
        notes: form.notes,
        entries: [
          {
            ...blank(CLIMBING_WORKOUT_TYPE),
            exercise: form.movement,
            workoutType: CLIMBING_WORKOUT_TYPE,
            entryKind: CLIMBING_WORKOUT_TYPE,
            duration,
            rpe: form.rpe,
            notes: form.notes,
            climbingTrackingMode: trackingMode,
            climbingBoulders: form.problemsOrRoutes,
            climbingMaxGrade: form.grade,
            climbingGradient: supportsClimbingGradient(form.movement) ? form.gradient : "",
          },
        ],
        methodBlocks: [],
      });
    },
    onSuccess: async (result) => {
      if (loadedSuggestionId) {
        try {
          await completeSuggestedWorkoutClient(loadedSuggestionId, result.sessionId);
          qc.invalidateQueries({ queryKey: ["next-suggested-workouts"] });
          qc.invalidateQueries({ queryKey: ["workout-lifecycle"] });
        } catch {
          toast.warning("Climb saved, but the plan could not be marked complete.");
        }
      }
      toast.success("Climb logged", {
        description: `${climbMovementLabel(form.movement)} · ${totalMinutes} minutes`,
      });
      setForm((current) => ({
        ...blankClimbForm(),
        trainingLocationId: current.trainingLocationId,
      }));
      setDuplicateOpen(false);
      setLoadedSuggestionId(null);
      setLoadedPlanTitle("");
      qc.invalidateQueries({ queryKey: ["recent-workouts"] });
      qc.invalidateQueries({ queryKey: ["recent-climbs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["timeline"] });
      qc.invalidateQueries({ queryKey: ["exercise-history"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canSubmit = Boolean(
    form.date &&
    form.trainingLocationId &&
    form.movement &&
    movementAvailable &&
    !validationIssue &&
    !mutate.isPending,
  );

  const submit = async (skipDuplicateCheck = false) => {
    if (!canSubmit || checkingDuplicate) return;
    if (!skipDuplicateCheck) {
      setCheckingDuplicate(true);
      try {
        const [unifiedDuplicate, legacyDuplicate] = await Promise.all([
          findDuplicateLogClient({
            date: form.date,
            title: form.movement,
            sourceSheet: "Workout Log",
          }),
          findDuplicateLogClient({
            date: form.date,
            title: form.movement,
            sourceSheet: "Climbing Log",
          }),
        ]);
        if (unifiedDuplicate || legacyDuplicate) {
          setDuplicateOpen(true);
          return;
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not check for duplicates.");
        return;
      } finally {
        setCheckingDuplicate(false);
      }
    }
    mutate.mutate();
  };

  return (
    <div className="space-y-4">
      {!loadedSuggestionId && climbingPlans.length ? (
        <section className="space-y-2">
          <div>
            <h2 className="text-base font-semibold">Next climb</h2>
            <p className="text-xs text-muted-foreground">
              Saved climbing circuits stay here until you use or skip them.
            </p>
          </div>
          {climbingPlans.map((plan) => (
            <Card
              key={plan.suggestedWorkoutId}
              className="border-amber-400/25 bg-amber-400/[0.05] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{plan.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.basis}</p>
                </div>
                <WorkoutLifecycleBadge state={workoutPlanLifecycleState(plan.status)} />
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <Button
                  type="button"
                  onClick={() => useSavedClimbingPlan.mutate(plan)}
                  disabled={useSavedClimbingPlan.isPending || skipSavedClimbingPlan.isPending}
                >
                  {useSavedClimbingPlan.isPending &&
                  useSavedClimbingPlan.variables?.suggestedWorkoutId === plan.suggestedWorkoutId ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Load climb
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => skipSavedClimbingPlan.mutate(plan.suggestedWorkoutId)}
                  disabled={useSavedClimbingPlan.isPending || skipSavedClimbingPlan.isPending}
                >
                  Skip
                </Button>
              </div>
            </Card>
          ))}
        </section>
      ) : null}
      {loadedSuggestionId ? (
        <Card className="border-amber-400/25 bg-amber-400/[0.05] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{loadedPlanTitle}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Planned circuit loaded · completing this form will complete the saved plan.
              </p>
            </div>
            <WorkoutLifecycleBadge state={workoutPlanLifecycleState("accepted")} />
          </div>
        </Card>
      ) : null}
      <Card className="space-y-5 border-border bg-card p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold">Log a climb</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Record the useful session details without building a workout.
          </p>
        </div>

        <Field label="Where did you climb?">
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {climbingLocations.map((location) => (
              <Button
                key={location.id}
                type="button"
                variant={form.trainingLocationId === location.id ? "secondary" : "outline"}
                className={
                  form.trainingLocationId === location.id
                    ? "border-primary/40 bg-primary/10 text-primary sm:min-w-28"
                    : "sm:min-w-28"
                }
                onClick={() => {
                  update("trainingLocationId", location.id);
                  window.localStorage.setItem(WORKOUT_TRAINING_LOCATION_KEY, location.id);
                }}
              >
                {location.name}
              </Button>
            ))}
          </div>
          {library.isLoading || locations.isLoading ? (
            <p className="mt-2 text-xs text-muted-foreground">Loading climbing locations…</p>
          ) : climbingLocations.length === 0 ? (
            <p className="mt-2 text-xs text-amber-300">
              No active training locations have a {CLIMBING_WALL_EQUIPMENT_NAME} assigned. Add it
              under Manage → Training Locations.
            </p>
          ) : null}
        </Field>

        <Field label="What did you climb?">
          <div className="grid grid-cols-2 gap-2">
            {CLIMBING_MOVEMENTS.map((movement) => {
              const meta = library.data?.exercises.find((exercise) => exercise.name === movement);
              const available = Boolean(
                meta?.availableLocationIds.includes(form.trainingLocationId),
              );
              return (
                <Button
                  key={movement}
                  type="button"
                  variant={form.movement === movement ? "secondary" : "outline"}
                  className="h-11"
                  disabled={!available}
                  title={
                    available
                      ? undefined
                      : `${meta?.equipment || "Required equipment"} is not available at ${selectedLocation?.name ?? "this location"}`
                  }
                  onClick={() => {
                    update("movement", movement);
                    if (!supportsClimbingGradient(movement)) update("gradient", "");
                  }}
                >
                  {climbMovementLabel(movement)}
                </Button>
              );
            })}
          </div>
          {form.trainingLocationId && !movementAvailable ? (
            <p className="mt-2 text-xs text-amber-300">
              {movementMeta?.equipment || "Required climbing equipment"} is not assigned to{" "}
              {selectedLocation?.name ?? "this location"}. Update the location equipment or choose
              another movement.
            </p>
          ) : null}
        </Field>

        <Field label="Duration">
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={12}
                step={1}
                className="h-12 pr-14 text-lg"
                value={form.durationHours}
                onChange={(event) => update("durationHours", event.target.value)}
                placeholder="1"
                aria-label="Climbing duration hours"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                hours
              </span>
            </div>
            <div className="relative">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                step={1}
                className="h-12 pr-16 text-lg"
                value={form.durationMinutes}
                onChange={(event) => update("durationMinutes", event.target.value)}
                placeholder="15"
                aria-label="Climbing duration minutes"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                minutes
              </span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Required · maximum 12 hours.</p>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`${climbCountLabel(form.movement)} (optional)`}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={form.problemsOrRoutes}
              onChange={(event) => update("problemsOrRoutes", event.target.value)}
              placeholder="Leave blank for time only"
            />
          </Field>
          <Field label="Max grade (optional)">
            <Input
              value={form.grade}
              onChange={(event) => update("grade", event.target.value)}
              placeholder="V5, 6b+, 7A..."
            />
          </Field>
        </div>

        <div
          className={`grid gap-3 ${supportsClimbingGradient(form.movement) ? "grid-cols-2" : ""}`}
        >
          {supportsClimbingGradient(form.movement) ? (
            <Field label="Gradient (optional)">
              <SimpleSelect
                value={form.gradient}
                onChange={(value) => update("gradient", value)}
                options={BOARD_GRADIENTS}
              />
            </Field>
          ) : null}
          <Field label="RPE (optional)">
            <Input
              type="number"
              inputMode="decimal"
              min={1}
              max={10}
              step={0.5}
              value={form.rpe}
              onChange={(event) => update("rpe", event.target.value)}
              placeholder="1–10"
            />
          </Field>
        </div>

        <details className="rounded-lg border border-border bg-secondary/20 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">More details</summary>
          <div className="mt-4 space-y-4">
            <Field label="Date">
              <DateInput value={form.date} onChange={(value) => update("date", value)} />
            </Field>
            <Field label="Notes">
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
                placeholder="Projects, attempts, how it felt..."
              />
            </Field>
          </div>
        </details>

        {hasStartedMetrics && validationIssue ? (
          <p className="text-xs font-medium text-destructive">{validationIssue}</p>
        ) : null}

        <Button
          type="button"
          onClick={() => submit()}
          disabled={!canSubmit || checkingDuplicate}
          className="h-12 w-full text-base font-semibold"
          style={{ backgroundImage: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
        >
          {mutate.isPending || checkingDuplicate ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CircleCheck className="mr-1.5 h-5 w-5" />
          )}
          {checkingDuplicate ? "Checking…" : mutate.isPending ? "Logging climb…" : "Log climb"}
        </Button>
      </Card>

      <AlertDialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Already logged today</AlertDialogTitle>
            <AlertDialogDescription>
              {form.movement} already has an entry on {formatUKDate(form.date)}. Log another one
              anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => submit(true)}>Log another</AlertDialogAction>
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
  const [uncategorizedConfirmed, setUncategorizedConfirmed] = useState(false);
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
  const workoutLibraryExercises = useMemo(
    () => allLibraryExercises.filter((exercise) => exercise.workoutType !== CLIMBING_WORKOUT_TYPE),
    [allLibraryExercises],
  );
  const recentWorkoutLogs = useMemo(
    () => (recent.data?.recent ?? []).filter((item) => item.workoutType !== CLIMBING_WORKOUT_TYPE),
    [recent.data?.recent],
  );
  const selectedLocationKind = locations.data?.find(
    (location) => location.id === form.trainingLocationId,
  )?.kind;
  const libraryExercises = useMemo(
    () =>
      form.trainingLocationId
        ? workoutLibraryExercises.filter(
            (exercise) =>
              (!("locationScope" in exercise) ||
                exercise.locationScope === "both" ||
                exercise.locationScope === selectedLocationKind) &&
              (!("availableLocationIds" in exercise) ||
                !Array.isArray(exercise.availableLocationIds) ||
                exercise.availableLocationIds.includes(form.trainingLocationId)),
          )
        : workoutLibraryExercises,
    [form.trainingLocationId, selectedLocationKind, workoutLibraryExercises],
  );
  const availableExerciseNames = useMemo(
    () => new Set(libraryExercises.map((exercise) => exercise.name.toLowerCase())),
    [libraryExercises],
  );
  const recentExerciseNames = useMemo(() => {
    const completed = recentWorkoutLogs.filter((item) => item.completed && item.exercise);
    const locationMatches = selectedLocationKind
      ? completed.filter((item) => item.trainingLocation?.kind === selectedLocationKind)
      : completed;
    const source = locationMatches.length > 0 ? locationMatches : completed;
    return Array.from(new Set(source.map((item) => item.exercise))).slice(0, 10);
  }, [recentWorkoutLogs, selectedLocationKind]);
  const recentSessionTemplates = useMemo(
    () =>
      buildRecentSessionTemplates(
        recentWorkoutLogs,
        selectedLocationKind,
        new Set(libraryExercises.map((exercise) => exercise.name.toLowerCase())),
      ),
    [libraryExercises, recentWorkoutLogs, selectedLocationKind],
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
        (location) =>
          location.id === draft.trainingLocationId ||
          (!draft.trainingLocationId && location.kind === draft.locationKind),
      );
      const entries = draft.movements.map((movement) => {
        const totalReps = movement.setRows.reduce(
          (total, set) => total + (Number(set.reps) || 0),
          0,
        );
        const firstSet = movement.setRows[0];
        return {
          ...blankSessionEntry(),
          exercise: movement.exercise,
          workoutType: movement.workoutType,
          sets: movement.targets.rounds || String(movement.setRows.length),
          reps: totalReps ? String(totalReps) : "",
          weight: firstSet?.weight ?? "",
          duration: movement.targets.durationMinutes,
          holdSeconds: firstSet?.durationSeconds ?? "",
          distance: movement.targets.distance,
          distanceUnit: movement.targets.distanceUnit || "cm",
          rounds: movement.targets.rounds,
          height: movement.targets.height,
          detail: movement.targets.detail,
          restTime: movement.restTime ?? "",
          setRows: movement.setRows.map((set) => ({
            ...set,
            completed: true,
          })),
        };
      });
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
      const session = buildRecentSessionTemplates(recentWorkoutLogs).find(
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
  }, [
    draftStorageKey,
    initialFormLoaded,
    loadPlanIntoForm,
    locations.data,
    recent.data,
    recentWorkoutLogs,
  ]);

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
      qc.invalidateQueries({ queryKey: ["workout-lifecycle"] });
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
      qc.invalidateQueries({ queryKey: ["workout-lifecycle"] });
      toast.message("Workout plan skipped");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!initialFormLoaded) return;
    if (form.trainingLocationId || !locations.data?.length) return;
    const remembered = window.localStorage.getItem(WORKOUT_TRAINING_LOCATION_KEY);
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
  const selectEntryExercise = (index: number, name: string) => {
    const selected = libraryExercises.find((exercise) => exercise.name === name);
    const selectedProfile = getMovementMetricProfile({
      workoutType: selected?.workoutType ?? "Other",
      movement: name,
      defaultMetric: selected?.metric,
    });

    setForm((current) => {
      const currentEntry = current.entries[index];
      if (!currentEntry) return current;

      const nextEntry: FormState = {
        ...currentEntry,
        exercise: name,
        workoutType: selected?.workoutType ?? "Other",
        entryKind:
          selected?.workoutType === SKILL_WORKOUT_TYPE
            ? "Skill"
            : selected?.workoutType === GRIP_WORKOUT_TYPE
              ? GRIP_WORKOUT_TYPE
              : "Workout",
        distanceUnit:
          selectedProfile === "mobility_position"
            ? "cm"
            : selectedProfile === "carry"
              ? "m"
              : selectedProfile === "time"
                ? "km"
                : "",
        climbingTrackingMode: selectedProfile === "climbing" ? "Problems / routes" : "",
        climbingGradient: supportsClimbingGradient(name) ? currentEntry.climbingGradient : "",
        positionMeasurementCm: selected?.positionMeasurementGuide
          ? currentEntry.positionMeasurementCm
          : "",
        positionMeasurementSetup: selected?.positionMeasurementGuide
          ? currentEntry.positionMeasurementSetup
          : "",
        loadSemantics: "",
        setRows: [blankSet()],
      };

      return {
        ...current,
        entries: current.entries.map((entry, entryIndex) =>
          entryIndex === index ? nextEntry : entry,
        ),
        methodBlocks: profileSupportsAdvancedMethods(selectedProfile)
          ? current.methodBlocks
          : removeMovementFromMethodBlocks(current.methodBlocks, currentEntry.clientId),
      };
    });
  };
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
      const methodBlocks = removedId
        ? removeMovementFromMethodBlocks(current.methodBlocks, removedId)
        : current.methodBlocks;
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
    const matches = recentWorkoutLogs.filter(
      (item) => item.completed && item.exercise.toLowerCase() === exerciseName.trim().toLowerCase(),
    );
    return (
      matches.find((item) => item.trainingLocation?.kind === selectedLocationKind) ?? matches[0]
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
    completed: true,
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
        setRows:
          profileUsesStandardSets(profile) ||
          profile === "hold" ||
          profile === "grip" ||
          entry.setRows.some((set) => set.durationSeconds)
            ? entry.setRows
            : [],
        date: form.date,
        workoutType: selected?.workoutType ?? entry.workoutType,
        focusArea: "",
        completed: true,
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
          qc.invalidateQueries({ queryKey: ["workout-lifecycle"] });
          qc.invalidateQueries({ queryKey: ["programme-workout-offers"] });
          qc.invalidateQueries({ queryKey: ["programme-assignments"] });
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
  const climbingIssues = form.entries
    .filter((entry) => {
      const selected = libraryExercises.find(
        (exercise) => exercise.name.toLowerCase() === entry.exercise.trim().toLowerCase(),
      );
      return (
        entry.exercise.trim() &&
        getMovementMetricProfile({
          workoutType: selected?.workoutType ?? entry.workoutType,
          movement: entry.exercise,
          defaultMetric: selected?.metric,
        }) === "climbing"
      );
    })
    .map((entry) =>
      climbingMetricIssue({
        minutes: entry.duration,
        trackingMode: entry.climbingTrackingMode,
        problemsOrRoutes: entry.climbingBoulders,
      }),
    )
    .filter(Boolean);
  const dumbbellSemanticsMissing = form.entries.some((entry) => {
    const selected = libraryExercises.find(
      (exercise) => exercise.name.toLowerCase() === entry.exercise.trim().toLowerCase(),
    );
    const isDumbbell = coerceExerciseEquipment(selected).includes("dumbbell");
    return (
      isDumbbell && entry.setRows.some((set) => Number(set.weight) > 0) && !entry.loadSemantics
    );
  });
  const canSubmit =
    form.date &&
    form.trainingLocationId &&
    form.entries.some((entry) => entry.exercise.trim()) &&
    form.entries.every(
      (entry) =>
        !entry.exercise.trim() ||
        libraryExercises.some(
          (exercise) => exercise.name.toLowerCase() === entry.exercise.trim().toLowerCase(),
        ),
    ) &&
    !incompleteSetMethod &&
    !dumbbellSemanticsMissing &&
    climbingIssues.length === 0 &&
    !mutate.isPending;
  const hasDraftContent = sessionHasDraftContent(form);
  const draftTime = draftSavedAt
    ? new Date(draftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  const workoutEntries = form.entries.filter((entry) => entry.exercise.trim());
  const uncategorizedEntries = workoutEntries.filter((entry) => entry.workoutType === "Other");
  const unavailableWorkoutEntries = workoutEntries.filter(
    (entry) =>
      !libraryExercises.some(
        (exercise) => exercise.name.toLowerCase() === entry.exercise.trim().toLowerCase(),
      ),
  );
  const advancedMethodEntries = workoutEntries.filter((entry) => {
    const selected = libraryExercises.find(
      (exercise) => exercise.name.toLowerCase() === entry.exercise.trim().toLowerCase(),
    );
    return profileSupportsAdvancedMethods(
      getMovementMetricProfile({
        workoutType: selected?.workoutType ?? entry.workoutType,
        movement: entry.exercise,
        defaultMetric: selected?.metric,
      }),
    );
  });
  const selectedLocation = locations.data?.find(
    (location) => location.id === form.trainingLocationId,
  );
  const totalRecordedSets = workoutEntries.reduce(
    (total, entry) =>
      total +
      entry.setRows.filter(
        (set) => set.reps || set.weight || set.durationSeconds || set.rpe || set.method,
      ).length,
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
    setForm({
      ...lastCompletedWorkout.form,
      completed: true,
    });
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
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">Today&apos;s workout is saved</p>
                <WorkoutLifecycleBadge state="completed" />
              </div>
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
                      <WorkoutLifecycleBadge state={workoutPlanLifecycleState(plan.status)} />
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
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground">
                Choose where, then log one movement or add the whole session.
              </p>
              {hasDraftContent ? <WorkoutLifecycleBadge state="in_progress" /> : null}
            </div>
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
                  window.localStorage.setItem(WORKOUT_TRAINING_LOCATION_KEY, location.id);
                }}
              >
                {location.name}
              </Button>
            ))}
          </div>
        </Field>

        {unavailableWorkoutEntries.length > 0 ? (
          <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-xs text-amber-100">
            <p className="font-medium">Some movements are not available here</p>
            <p className="mt-1 text-amber-100/80">
              {unavailableWorkoutEntries.map((entry) => entry.exercise).join(", ")} require
              equipment that is not assigned to this location. Remove them or choose another
              location before saving.
            </p>
          </div>
        ) : null}

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
        <h2 className="text-base font-semibold">Movements and sets</h2>
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
          const isDumbbell = coerceExerciseEquipment(selectedExercise).includes("dumbbell");
          const profile = getMovementMetricProfile({
            workoutType: selectedExercise?.workoutType ?? entry.workoutType,
            movement: entry.exercise,
            defaultMetric: selectedExercise?.metric,
          });
          const hasPlannedTimedSets = entry.setRows.some((set) => set.durationSeconds);
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
                    exercises={workoutLibraryExercises}
                    availableExerciseNames={availableExerciseNames}
                    selectedLocationName={selectedLocation?.name}
                    favoriteNames={favoriteExercises}
                    recentNames={recentExerciseNames}
                    onChange={(name) => selectEntryExercise(index, name)}
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
              {entry.exercise &&
              (profileUsesStandardSets(profile) ||
                profile === "hold" ||
                profile === "grip" ||
                hasPlannedTimedSets) ? (
                <div className="space-y-3">
                  <SetRowsEditor
                    rows={entry.setRows}
                    usesLoad={profileUsesLoad(profile)}
                    valueKind={
                      profile === "hold" || profile === "grip" || hasPlannedTimedSets
                        ? "duration"
                        : "reps"
                    }
                    durationLabel={
                      profile === "hold" || profile === "grip" || profile === "mobility_position"
                        ? "Hold (sec)"
                        : "Seconds"
                    }
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
                  {isDumbbell && entry.setRows.some((set) => Number(set.weight) > 0) ? (
                    <Field label="Dumbbell weight means">
                      <Select
                        value={entry.loadSemantics || undefined}
                        onValueChange={(value) =>
                          updateEntry(index, "loadSemantics", value as LoadSemantics)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose before saving" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_implement_load">Per dumbbell</SelectItem>
                          <SelectItem value="combined_implement_load">
                            Combined dumbbell weight
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : null}
                  {profile === "reps" || profile === "hold" || profile === "grip" ? (
                    <div className="grid gap-3 rounded-lg border border-border bg-secondary/20 p-3 sm:grid-cols-3">
                      <Field label={profile === "grip" ? "Grip style" : "Progression"}>
                        {profile === "grip" ? (
                          <SimpleSelect
                            value={entry.gripStyle}
                            onChange={(value) => updateEntry(index, "gripStyle", value)}
                            options={GRIP_STYLES}
                          />
                        ) : (
                          <Input
                            value={entry.progressionLevel}
                            onChange={(event) =>
                              updateEntry(index, "progressionLevel", event.target.value)
                            }
                            placeholder={
                              profile === "hold"
                                ? "Full, straddle, tuck..."
                                : "Strict, assisted, variation..."
                            }
                          />
                        )}
                      </Field>
                      <Field label={profile === "grip" ? "Load type" : "Assistance"}>
                        <SimpleSelect
                          value={profile === "grip" ? entry.gripLoadType : entry.assistanceType}
                          onChange={(value) =>
                            updateEntry(
                              index,
                              profile === "grip" ? "gripLoadType" : "assistanceType",
                              value,
                            )
                          }
                          options={
                            profile === "grip" ? GRIP_LOAD_TYPES : (lib.data?.assistanceTypes ?? [])
                          }
                        />
                      </Field>
                      <Field label={profile === "grip" ? "Load detail" : "Assistance detail"}>
                        <Input
                          value={entry.assistanceDetail}
                          onChange={(event) =>
                            updateEntry(index, "assistanceDetail", event.target.value)
                          }
                          placeholder={
                            profile === "grip"
                              ? "20mm edge, +10kg..."
                              : "8.5 kg counterweight, band colour..."
                          }
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
                    validationIssue={
                      profile === "climbing"
                        ? climbingMetricIssue({
                            minutes: entry.duration,
                            trackingMode: entry.climbingTrackingMode,
                            problemsOrRoutes: entry.climbingBoulders,
                          })
                        : null
                    }
                  />
                )
              )}
              {entry.exercise && selectedExercise?.positionMeasurementGuide ? (
                <PositionMeasurementField
                  label={selectedExercise.positionMeasurementLabel || "Position height"}
                  direction={selectedExercise.positionMeasurementDirection || "neutral"}
                  value={entry.positionMeasurementCm}
                  setup={entry.positionMeasurementSetup}
                  onChange={(value, setup) => {
                    updateEntry(index, "positionMeasurementCm", value);
                    updateEntry(index, "positionMeasurementSetup", setup);
                  }}
                />
              ) : null}
              {entry.exercise && entry.workoutType.trim().toLowerCase() === "strength" ? (
                <div className="grid gap-3 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] p-3 sm:grid-cols-2">
                  <Field label="Technique (optional)">
                    <Select
                      value={entry.technique || undefined}
                      onValueChange={(value) => updateEntry(index, "technique", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose after the lift" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="acceptable">Acceptable</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Pain (0-10, optional)">
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={1}
                      inputMode="numeric"
                      value={entry.pain}
                      onChange={(event) => updateEntry(index, "pain", event.target.value)}
                      placeholder="0"
                    />
                  </Field>
                  <p className="text-[10px] leading-relaxed text-muted-foreground sm:col-span-2">
                    Programme lifts use completed reps, set RPE, technique, and pain to progress,
                    hold, or reduce the next prescription. This check-in does not diagnose or
                    prescribe rehabilitation.
                  </p>
                </div>
              ) : null}
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

      {advancedMethodEntries.length > 0 ? (
        <Card className="space-y-3 border-border bg-card p-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Layers3 className="h-4 w-4 text-indigo-300" /> Advanced methods
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
      ) : null}

      <div className="sticky bottom-20 z-10 rounded-xl border border-border bg-background/95 p-2 shadow-xl backdrop-blur sm:bottom-3">
        <p className="sr-only">Finished workouts appear in History and on the Dashboard.</p>
        <Button
          onClick={() => setFinishSummaryOpen(true)}
          disabled={!canSubmit}
          className={`h-12 w-full text-base font-semibold ${canSubmit ? "text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          style={canSubmit ? { backgroundImage: "var(--gradient-primary)" } : undefined}
        >
          <CircleCheck className="mr-1.5 h-5 w-5" />
          {editingSessionId ? "Review correction" : "Review and finish"}
        </Button>
      </div>
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
        onOpenChange={(open) => {
          if (mutate.isPending) return;
          setFinishSummaryOpen(open);
          if (!open) setUncategorizedConfirmed(false);
        }}
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
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Sets / efforts
              </p>
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
                <p className="mt-1 text-xs text-muted-foreground">
                  {workoutEntrySummary(
                    entry,
                    getMovementMetricProfile({
                      workoutType:
                        libraryExercises.find(
                          (exercise) =>
                            exercise.name.toLowerCase() === entry.exercise.trim().toLowerCase(),
                        )?.workoutType ?? entry.workoutType,
                      movement: entry.exercise,
                      defaultMetric: libraryExercises.find(
                        (exercise) =>
                          exercise.name.toLowerCase() === entry.exercise.trim().toLowerCase(),
                      )?.metric,
                    }),
                  )}
                </p>
              </div>
            ))}
          </div>

          {uncategorizedEntries.length ? (
            <label className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] p-3 text-sm">
              <Checkbox
                checked={uncategorizedConfirmed}
                onCheckedChange={(checked) => setUncategorizedConfirmed(checked === true)}
              />
              <span>
                I confirm {uncategorizedEntries.map((entry) => entry.exercise).join(", ")} should
                remain uncategorised.
              </span>
            </label>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={mutate.isPending}
              onClick={() => setFinishSummaryOpen(false)}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              disabled={
                mutate.isPending || (uncategorizedEntries.length > 0 && !uncategorizedConfirmed)
              }
              onClick={() => mutate.mutate()}
            >
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
        entries={advancedMethodEntries}
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

function MovementPicker({
  value,
  exercises,
  availableExerciseNames,
  selectedLocationName,
  favoriteNames,
  recentNames,
  onChange,
}: {
  value: string;
  exercises: { name: string; workoutType: string; equipment?: string; quickLog?: boolean }[];
  availableExerciseNames: Set<string>;
  selectedLocationName?: string;
  favoriteNames: string[];
  recentNames: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const favoriteSet = new Set(favoriteNames.map((name) => name.toLowerCase()));
  const recentSet = new Set(recentNames.map((name) => name.toLowerCase()));
  const normalizedQuery = query.trim().toLowerCase();
  const nameMatches = (exercise: (typeof exercises)[number]) =>
    !normalizedQuery || exercise.name.toLowerCase().includes(normalizedQuery);
  const availableExercises = exercises.filter(
    (exercise) => availableExerciseNames.has(exercise.name.toLowerCase()) && nameMatches(exercise),
  );
  const unavailableExercises = normalizedQuery
    ? exercises.filter(
        (exercise) =>
          !availableExerciseNames.has(exercise.name.toLowerCase()) && nameMatches(exercise),
      )
    : [];
  const quickExercises = availableExercises.filter((exercise) => exercise.quickLog);
  const quickSet = new Set(quickExercises.map((exercise) => exercise.name.toLowerCase()));
  const favoriteExercises = availableExercises.filter(
    (exercise) =>
      favoriteSet.has(exercise.name.toLowerCase()) && !quickSet.has(exercise.name.toLowerCase()),
  );
  const recentExercises = availableExercises.filter(
    (exercise) =>
      recentSet.has(exercise.name.toLowerCase()) &&
      !favoriteSet.has(exercise.name.toLowerCase()) &&
      !quickSet.has(exercise.name.toLowerCase()),
  );
  const otherExercises = availableExercises.filter(
    (exercise) =>
      !favoriteSet.has(exercise.name.toLowerCase()) &&
      !recentSet.has(exercise.name.toLowerCase()) &&
      !quickSet.has(exercise.name.toLowerCase()),
  );
  const groups = [
    { label: "Quick logging", exercises: quickExercises },
    { label: "Favourites", exercises: favoriteExercises },
    { label: "Recent", exercises: recentExercises },
    { label: "All movements", exercises: otherExercises },
    {
      label: selectedLocationName
        ? `Not available at ${selectedLocationName}`
        : "Not available at this location",
      exercises: unavailableExercises,
      unavailable: true,
    },
  ].filter((group) => group.exercises.length > 0);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
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
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search movement name..."
          />
          <CommandList>
            <CommandEmpty>No movement name matches.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.label} heading={group.label}>
                {group.exercises.map((exercise) => (
                  <CommandItem
                    key={exercise.name}
                    value={exercise.name}
                    disabled={group.unavailable}
                    onSelect={() => {
                      onChange(exercise.name);
                      setOpen(false);
                    }}
                  >
                    <Check className={value === exercise.name ? "opacity-100" : "opacity-0"} />
                    <span className="min-w-0 flex-1 truncate">{exercise.name}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {group.unavailable ? "Equipment not assigned" : exercise.workoutType}
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
  valueKind = "reps",
  durationLabel = "Hold (sec)",
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
  valueKind?: "reps" | "duration";
  durationLabel?: string;
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
        <span>{valueKind === "duration" ? durationLabel : "Reps"}</span>
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
                  {valueKind === "duration" ? durationLabel : "Reps"}
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={valueKind === "duration" ? 0.1 : 1}
                  className="h-12 text-lg font-semibold sm:h-10 sm:text-sm sm:font-normal"
                  aria-label={`Set ${setIndex + 1} ${
                    valueKind === "duration" && durationLabel === "Hold (sec)"
                      ? "hold seconds"
                      : valueKind === "duration"
                        ? "seconds"
                        : "reps"
                  }`}
                  value={valueKind === "duration" ? set.durationSeconds : set.reps}
                  onChange={(event) =>
                    valueKind === "duration"
                      ? onChange(setIndex, "durationSeconds", event.target.value)
                      : onChange(setIndex, "reps", event.target.value)
                  }
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
  validationIssue = null,
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
  validationIssue?: string | null;
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
          <div className="space-y-1.5">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={5}
              step={1}
              value={form.feel}
              onChange={(e) => update("feel", e.target.value)}
            />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              1 restricted · 3 normal · 5 free and comfortable. Treat pain separately and stop.
            </p>
          </div>
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
    const showGradient = supportsClimbingGradient(form.exercise);
    return (
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tracking mode">
            <SimpleSelect
              value={form.climbingTrackingMode}
              onChange={(value) => {
                update("climbingTrackingMode", value);
                if (value === "Time only") update("climbingBoulders", "");
              }}
              options={[...CLIMBING_TRACKING_MODES]}
            />
          </Field>
          <Field label="Duration (minutes)">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_CLIMBING_MINUTES}
              step={1}
              value={form.duration}
              onChange={(event) => update("duration", event.target.value)}
              placeholder="75"
            />
          </Field>
          {form.climbingTrackingMode !== "Time only" ? (
            <Field label="Problems / routes">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={form.climbingBoulders}
                onChange={(event) => update("climbingBoulders", event.target.value)}
              />
            </Field>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Enter total minutes — for example, 1h 15m is 75.
        </p>
        <div className={`grid gap-3 ${showGradient ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          <Field label="Max grade">
            <Input
              value={form.climbingMaxGrade}
              onChange={(event) => update("climbingMaxGrade", event.target.value)}
              placeholder="V5, 6b+, 7A..."
            />
          </Field>
          {showGradient ? (
            <Field label="Gradient">
              <SimpleSelect
                value={form.climbingGradient}
                onChange={(value) => update("climbingGradient", value)}
                options={BOARD_GRADIENTS}
              />
            </Field>
          ) : null}
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
        {validationIssue ? (
          <p className="text-xs font-medium text-destructive">{validationIssue}</p>
        ) : null}
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

function PositionMeasurementField({
  label,
  direction,
  value,
  setup,
  onChange,
}: {
  label: string;
  direction: string;
  value: string;
  setup: string;
  onChange: (value: string, setup: string) => void;
}) {
  const matched = blockHeightOption(value, setup);
  const selectedValue = matched ? String(matched.heightCm) : "custom";

  return (
    <div className="space-y-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Foam and cork block guide · {formatPositionMeasurementDirection(direction)}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label="Block stack">
          <Select
            value={value ? selectedValue : undefined}
            onValueChange={(nextValue) => {
              if (nextValue === "custom") {
                onChange(matched ? "" : value, "");
                return;
              }
              const option = BLOCK_HEIGHT_OPTIONS.find(
                (candidate) => String(candidate.heightCm) === nextValue,
              );
              if (option) onChange(String(option.heightCm), option.setup);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a block height" />
            </SelectTrigger>
            <SelectContent>
              {BLOCK_HEIGHT_OPTIONS.map((option) => (
                <SelectItem
                  key={`${option.heightCm}-${option.setup}`}
                  value={String(option.heightCm)}
                >
                  {option.heightCm} cm — {option.setup}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom measurement…</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Custom (cm)">
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            value={matched ? "" : value}
            onChange={(event) => onChange(event.target.value, "")}
            placeholder={matched ? `${matched.heightCm}` : "e.g. 8.5"}
          />
        </Field>
      </div>
      {matched ? (
        <p className="text-xs text-amber-100/80">
          {matched.heightCm} cm · bottom to top: {matched.setup}
        </p>
      ) : value ? (
        <p className="text-xs text-muted-foreground">Custom measurement: {value} cm</p>
      ) : null}
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
