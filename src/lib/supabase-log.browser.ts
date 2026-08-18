import {
  supabasePublicDelete,
  supabasePublicInsert,
  supabasePublicRpc,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import { claimNoamProfile, getCurrentPerson } from "./supabase-people.browser";
import { climbingMetricIssue, supportsClimbingGradient } from "./climbing-metrics";
import { listLibraryClient } from "./supabase-library.browser";
import {
  type CircuitDifficulty,
  type CircuitDoseMode,
  type CircuitImpact,
  type CircuitMovementPattern,
  type CircuitSuitability,
} from "./circuit-metadata";
import {
  explicitLoadClassification,
  inferLoadClassification,
  isSetlessActivity,
  type DataShape,
  type LoadSemantics,
} from "./data-quality";
import { workoutSessionDraftKey } from "./workout-local-state";
import { enqueueWorkoutSave, isLikelyOfflineError } from "./workout-offline-queue";

export const REST_OPTIONS = [
  "0–30s",
  "30–60s",
  "60–90s",
  "90–120s",
  "120–150s",
  "150–180s",
  "180–210s",
  "210–240s",
  "240–270s",
  "270–300s",
];

export const BOARD_GRADIENTS = ["0°", "15°", "30°", "45°", "60°"];

export const ONE_RM_EXERCISES = [
  "Back Squat",
  "Bench Press",
  "Deadlift",
  "Overhead Press",
  "Barbell Row",
  "Weighted Pull-Up",
  "Weighted Chin-Up",
  "Weighted Dip",
  "Push-Up",
  "Bulgarian Split Squat",
  "Hip Thrust",
  "Other",
];

export const ONE_RM_TYPES = ["External Load", "Weighted Bodyweight"];
export const ONE_RM_SOURCES = ["Test", "Workout", "Estimate"];
export const ONE_RM_DEFAULT_FORMULA = "Epley";

const SKILL_WORKOUT_TYPE = "Skills/Calisthenics";
const GRIP_WORKOUT_TYPE = "Grip";

const FALLBACK_SETTINGS = {
  intensities: ["Low", "Moderate", "High", "Max"],
  climbingTypes: ["Climbing"],
  trackingModes: ["Hours", "Boulders"],
  assistanceTypes: ["None", "Band", "Counterweight", "Partner", "Wall/support", "Other"],
  qualities: ["Poor", "Okay", "Good", "Great"],
};

type ActivityTypeRecord = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

type ExerciseRecord = {
  id: string;
  focus_area: string | null;
  name: string;
  equipment: string | null;
  default_metric: string | null;
  suggested_sets: string | null;
  suggested_reps: string | null;
  notes: string | null;
  circuit_suitability: CircuitSuitability | null;
  circuit_pattern: CircuitMovementPattern | null;
  circuit_difficulty: CircuitDifficulty | null;
  circuit_impact: CircuitImpact | null;
  circuit_dose_mode: CircuitDoseMode | null;
  circuit_dose_min: number | string | null;
  circuit_dose_max: number | string | null;
  circuit_dose_per_side: boolean | null;
  activity_type_id: string | null;
  activity_types: { name: string | null } | null;
};

type EntrySetRecord = {
  set_number: number | string | null;
  reps: number | string | null;
  weight: number | string | null;
  duration_seconds: number | string | null;
  distance: number | string | null;
  distance_unit: string | null;
  rpe: number | string | null;
  rest_time: string | null;
  assistance_type: string | null;
  assistance_detail: string | null;
  quality: string | null;
  completed: boolean | null;
  data_shape: DataShape | null;
  aggregate_set_count: number | string | null;
  load_semantics: LoadSemantics | null;
  entry_set_segments: Array<{
    training_method_id: string;
    method_name: string;
    segment_index: number | string;
    reps: number | string | null;
    weight: number | string | null;
    rpe: number | string | null;
    rest_after_seconds: number | string | null;
    range_of_motion: string | null;
    config: Record<string, number | string | boolean> | null;
  }> | null;
};

type EntryMetricRecord = {
  metric_key: string;
  metric_value: number | string | null;
  metric_text: string | null;
  metric_unit: string | null;
};

type SessionEntryRecord = {
  id: string;
  order_index: number | null;
  entry_kind: string | null;
  name: string;
  progression_level: string | null;
  completed: boolean;
  notes: string | null;
  source_sheet: string | null;
  exercises: {
    name: string | null;
    focus_area: string | null;
    activity_types: { name: string | null } | null;
  } | null;
  activity_types: { name: string | null } | null;
  entry_sets: EntrySetRecord[] | null;
  entry_metrics: EntryMetricRecord[] | null;
  sessions: {
    id: string;
    session_date: string;
    title: string | null;
    completed: boolean;
    duration_minutes: number | string | null;
    intensity: string | null;
    rpe: number | string | null;
    notes: string | null;
    source_sheet: string | null;
    activity_types: { name: string | null } | null;
    training_locations: TrainingLocation | null;
  } | null;
};

type SessionMethodBlockRecord = {
  session_id: string;
  training_method_id: string;
  method_name: string;
  family: "exercise_group" | "timed_density";
  rounds: number | string | null;
  rest_between_movements_seconds: number | string | null;
  rest_between_rounds_seconds: number | string | null;
  block_duration_seconds: number | string | null;
  work_interval_seconds: number | string | null;
  rest_interval_seconds: number | string | null;
  config: Record<string, number | string | boolean> | null;
  session_method_block_entries: Array<{
    session_entry_id: string;
    sequence_index: number | string | null;
  }> | null;
};

type OneRMRecord = {
  id: string;
  test_date: string;
  source: string | null;
  exercise_name: string;
  load_type: string | null;
  external_weight: number | string | null;
  reps: number | string | null;
  rpe: number | string | null;
  estimated_total: number | string | null;
  estimated_external: number | string | null;
  is_pr: boolean;
};

type BodyweightRecord = {
  id: string;
  logged_date: string;
  bodyweight: number | string;
  notes: string | null;
};

export type WorkoutLogInput = {
  clientId?: string;
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
  distance: string;
  distanceUnit: string;
  rounds: string;
  feel: string;
  height: string;
  positionMeasurementCm: string;
  positionMeasurementSetup: string;
  detail: string;
  climbingBoulders?: string;
  climbingTrackingMode?: string;
  climbingMaxGrade?: string;
  climbingGradeSystem?: string;
  climbingSendType?: string;
  climbingIsProject?: boolean;
  climbingGradient?: string;
  loadSemantics?: LoadSemantics | "";
  setRows?: WorkoutSetInput[];
};

export type WorkoutSetInput = {
  reps: string;
  weight: string;
  durationSeconds: string;
  rpe: string;
  completed: boolean;
  method?: WorkoutSetMethodInput;
};

export type WorkoutSetSegmentInput = {
  reps: string;
  weight: string;
  rpe: string;
  restAfterSeconds: string;
  rangeOfMotion: string;
};

export type WorkoutSetMethodInput = {
  trainingMethodId: string;
  methodName: string;
  systemKey?: string | null;
  segments: WorkoutSetSegmentInput[];
  config: Record<string, number | string | boolean>;
};

export type TrainingLocation = {
  id: string;
  name: string;
  kind: "home" | "gym" | "other";
  equipmentItemIds: string[];
};

export type WorkoutSessionInput = {
  date: string;
  title: string;
  trainingLocationId: string;
  duration: string;
  intensity: string;
  rpe: string;
  completed: boolean;
  notes: string;
  entries: WorkoutLogInput[];
  methodBlocks?: WorkoutMethodBlockInput[];
};

export type WorkoutMethodBlockInput = {
  trainingMethodId: string;
  methodName: string;
  family: "exercise_group" | "timed_density";
  rounds: string;
  restBetweenMovementsSeconds: string;
  restBetweenRoundsSeconds: string;
  blockDurationMinutes: string;
  workIntervalSeconds: string;
  restIntervalSeconds: string;
  completedRounds: string;
  memberClientIds: string[];
  config: Record<string, number | string | boolean>;
};

export type RecentWorkoutMethodBlockInput = Omit<WorkoutMethodBlockInput, "memberClientIds"> & {
  memberEntryIds: string[];
};

export type ClimbLogInput = {
  date: string;
  type: string;
  movement?: string;
  trackingMode: string;
  hours: string;
  boulders: string;
  grade: string;
  gradient: string;
  intensity: string;
  rpe: string;
  completed: boolean;
  notes: string;
};

export type OneRMInput = {
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

export type BodyweightInput = {
  date: string;
  bodyweight: string;
  notes: string;
};

export type DuplicateLogInput = {
  date: string;
  title: string;
  sourceSheet: "Workout Log" | "Climbing Log";
};

const toNum = (value: unknown): number | null => {
  if (value == null) return null;
  const text = value.toString().trim();
  if (!text) return null;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
};

function validatedFeel(value: unknown) {
  const feel = toNum(value);
  if (feel != null && (!Number.isInteger(feel) || feel < 1 || feel > 5)) {
    throw new Error("Feel must be a whole number from 1 to 5.");
  }
  return feel;
}

const asText = (value: unknown) => (value == null ? "" : value.toString());

function movementKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function repsPerSet(totalReps: number | null, sets: number | null) {
  if (totalReps == null || totalReps <= 0) return null;
  if (sets == null || sets <= 0) return Math.ceil(totalReps);
  return Math.ceil(totalReps / sets);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function requirePerson() {
  const person = (await getCurrentPerson()) ?? (await claimNoamProfile());
  if (!person) throw new Error("Link this login to your profile first.");
  return person;
}

async function getOrCreateActivityType(name: string) {
  const trimmed = name.trim() || "Other";
  const existing = await supabasePublicSelect<ActivityTypeRecord>("activity_types", {
    select: "id,name,slug,sort_order",
    name: `eq.${trimmed}`,
    limit: 1,
  });
  if (existing[0]) return existing[0];

  const slug = slugify(trimmed) || "other";
  const bySlug = await supabasePublicSelect<ActivityTypeRecord>("activity_types", {
    select: "id,name,slug,sort_order",
    slug: `eq.${slug}`,
    limit: 1,
  });
  if (bySlug[0]) return bySlug[0];

  const inserted = await supabasePublicInsert<ActivityTypeRecord>("activity_types", {
    name: trimmed,
    slug,
    sort_order: 500,
  });
  return inserted[0] ?? null;
}

async function findExercise(name: string) {
  const rows = await supabasePublicSelect<ExerciseRecord>("exercises", {
    select:
      "id,focus_area,name,equipment,default_metric,suggested_sets,suggested_reps,notes,activity_type_id,activity_types(name)",
    name: `eq.${name.trim()}`,
    is_active: "eq.true",
    limit: 1,
  });
  return rows[0] ?? null;
}

export async function getLibraryClient() {
  const person = await requirePerson();
  const library = await listLibraryClient(person.id);
  const availableExercises = library.items.filter((row) => row.enabled && row.active);

  return {
    exercises: availableExercises,
    workoutTypes: library.workoutTypes,
    focusAreas: Array.from(new Set(availableExercises.map((row) => row.focusArea).filter(Boolean))),
    equipmentItems: library.equipmentItems,
    locations: library.locations,
    ...FALLBACK_SETTINGS,
  };
}

export async function getTrainingLocationsClient(): Promise<TrainingLocation[]> {
  const person = await requirePerson();
  const [rows, assignments] = await Promise.all([
    supabasePublicSelect<{
      id: string;
      name: string;
      kind: "home" | "gym" | "other";
    }>("training_locations", {
      select: "id,name,kind",
      person_id: `eq.${person.id}`,
      is_active: "eq.true",
      order: "kind.asc,name.asc",
    }),
    supabasePublicSelect<{ location_id: string; equipment_item_id: string }>(
      "training_location_equipment",
      { select: "location_id,equipment_item_id" },
    ),
  ]);
  const equipmentByLocation = new Map<string, string[]>();
  for (const assignment of assignments) {
    const ids = equipmentByLocation.get(assignment.location_id) ?? [];
    ids.push(assignment.equipment_item_id);
    equipmentByLocation.set(assignment.location_id, ids);
  }
  return rows.map((row) => ({
    ...row,
    equipmentItemIds: equipmentByLocation.get(row.id) ?? [],
  }));
}

function metricValue(metrics: EntryMetricRecord[] | null | undefined, key: string) {
  const row = metrics?.find((metric) => metric.metric_key === key);
  return asText(row?.metric_text ?? row?.metric_value);
}

export async function getRecentLogsClient(limit = 15) {
  const person = await requirePerson();
  const rows = await supabasePublicSelect<SessionEntryRecord>("session_entries", {
    select:
      "id,order_index,entry_kind,name,progression_level,completed,notes,exercises(name,focus_area,activity_types(name)),activity_types(name),entry_sets(set_number,reps,weight,duration_seconds,distance,distance_unit,rpe,rest_time,assistance_type,assistance_detail,quality,completed,data_shape,aggregate_set_count,load_semantics,entry_set_segments(training_method_id,method_name,segment_index,reps,weight,rpe,rest_after_seconds,range_of_motion,config)),entry_metrics(metric_key,metric_value,metric_text,metric_unit),sessions!inner(id,person_id,session_date,title,completed,duration_minutes,intensity,rpe,notes,activity_types(name),training_locations(id,name,kind))",
    "sessions.person_id": `eq.${person.id}`,
    order: "created_at.desc",
    limit: Math.min(Math.max(Math.round(limit), 1), 500),
  });
  const sessionIds = Array.from(
    new Set(rows.map((row) => row.sessions?.id).filter((id): id is string => Boolean(id))),
  );
  const blockBatches: Promise<SessionMethodBlockRecord[]>[] = [];
  for (let index = 0; index < sessionIds.length; index += 100) {
    const batch = sessionIds.slice(index, index + 100);
    blockBatches.push(
      supabasePublicSelect<SessionMethodBlockRecord>("session_method_blocks", {
        select:
          "session_id,training_method_id,method_name,family,rounds,rest_between_movements_seconds,rest_between_rounds_seconds,block_duration_seconds,work_interval_seconds,rest_interval_seconds,config,session_method_block_entries(session_entry_id,sequence_index)",
        session_id: `in.(${batch.join(",")})`,
        order: "order_index.asc",
        limit: 1000,
      }),
    );
  }
  const blocksBySession = new Map<string, RecentWorkoutMethodBlockInput[]>();
  for (const block of (await Promise.all(blockBatches)).flat()) {
    const methodBlocks = blocksBySession.get(block.session_id) ?? [];
    methodBlocks.push({
      trainingMethodId: block.training_method_id,
      methodName: block.method_name,
      family: block.family,
      rounds: asText(block.rounds),
      restBetweenMovementsSeconds: asText(block.rest_between_movements_seconds),
      restBetweenRoundsSeconds: asText(block.rest_between_rounds_seconds),
      blockDurationMinutes:
        block.block_duration_seconds == null
          ? ""
          : String(Number(block.block_duration_seconds) / 60),
      workIntervalSeconds: asText(block.work_interval_seconds),
      restIntervalSeconds: asText(block.rest_interval_seconds),
      completedRounds: "",
      memberEntryIds: [...(block.session_method_block_entries ?? [])]
        .sort((a, b) => Number(a.sequence_index ?? 0) - Number(b.sequence_index ?? 0))
        .map((member) => member.session_entry_id),
      config: block.config ?? {},
    });
    blocksBySession.set(block.session_id, methodBlocks);
  }

  return {
    recent: rows.map((row) => {
      const sets = [...(row.entry_sets ?? [])].sort(
        (a, b) => Number(a.set_number ?? 0) - Number(b.set_number ?? 0),
      );
      const set = sets[0];
      const metrics = row.entry_metrics ?? [];
      const individualSets = sets.filter((item) => item.data_shape === "individual");
      const workRows: Array<{
        reps: number | string | null;
        weight: number | string | null;
      }> = [];
      for (const item of sets) {
        if (item.entry_set_segments?.length) workRows.push(...item.entry_set_segments);
        else workRows.push(item);
      }
      const totalReps = workRows.reduce((total, item) => total + (toNum(item.reps) ?? 0), 0);
      const maxWeight = workRows.reduce<number | null>((max, item) => {
        const weight = toNum(item.weight);
        return weight == null || (max != null && max >= weight) ? max : weight;
      }, null);
      const legacyClimbingHours = toNum(metricValue(metrics, "hours"));
      const duration =
        metricValue(metrics, "duration_minutes") ||
        (legacyClimbingHours != null ? asText(legacyClimbingHours * 60) : "") ||
        asText(row.sessions?.duration_minutes);
      return {
        entryId: row.id,
        date: row.sessions?.session_date ?? "",
        id: row.sessions?.id ?? "",
        orderIndex: Number(row.order_index ?? 0),
        sessionTitle: row.sessions?.title ?? "",
        workoutType:
          row.activity_types?.name ??
          row.exercises?.activity_types?.name ??
          row.sessions?.activity_types?.name ??
          "",
        focusArea: row.exercises?.focus_area ?? "",
        exercise: row.name,
        sets: asText(
          individualSets.length
            ? individualSets.length
            : (set?.aggregate_set_count ?? set?.set_number),
        ),
        reps: asText(totalReps),
        weight: asText(maxWeight ?? set?.weight),
        duration,
        intensity: row.sessions?.intensity ?? "",
        rpe: metricValue(metrics, "rpe") || asText(set?.rpe ?? row.sessions?.rpe),
        restTime: set?.rest_time ?? "",
        completed: row.completed && Boolean(row.sessions?.completed),
        notes: row.notes ?? row.sessions?.notes ?? "",
        entryKind: row.entry_kind ?? "",
        progressionLevel: row.progression_level ?? "",
        holdSeconds: asText(set?.duration_seconds),
        distance: asText(set?.distance),
        distanceUnit: set?.distance_unit ?? "",
        rounds: metricValue(metrics, "rounds"),
        feel: metricValue(metrics, "feel"),
        height: metricValue(metrics, "height"),
        positionMeasurementCm: metricValue(metrics, "position_measurement"),
        positionMeasurementSetup: metricValue(metrics, "position_measurement_setup"),
        detail: metricValue(metrics, "detail"),
        climbingBoulders: metricValue(metrics, "boulders"),
        climbingTrackingMode: metricValue(metrics, "tracking_mode"),
        climbingMaxGrade: metricValue(metrics, "grade"),
        climbingGradeSystem: metricValue(metrics, "grade_system"),
        climbingSendType: metricValue(metrics, "send_type"),
        climbingIsProject: metricValue(metrics, "is_project") === "1",
        climbingGradient: metricValue(metrics, "gradient"),
        assistanceType: set?.assistance_type ?? "",
        assistanceDetail: set?.assistance_detail ?? "",
        quality: set?.quality ?? "",
        technique: metricValue(metrics, "technique"),
        pain: metricValue(metrics, "pain"),
        loadSemantics: set?.load_semantics ?? "",
        trainingLocation: row.sessions?.training_locations ?? null,
        methodBlocks: blocksBySession.get(row.sessions?.id ?? "") ?? [],
        setRows: sets.map((item) => {
          const segments = [...(item.entry_set_segments ?? [])].sort(
            (a, b) => Number(a.segment_index) - Number(b.segment_index),
          );
          const firstSegment = segments[0];
          return {
            reps: asText(item.reps),
            weight: asText(item.weight),
            durationSeconds: asText(item.duration_seconds),
            rpe: asText(item.rpe),
            completed: item.completed !== false,
            method:
              firstSegment && segments.length > 1
                ? {
                    trainingMethodId: firstSegment.training_method_id,
                    methodName: firstSegment.method_name,
                    systemKey:
                      typeof firstSegment.config?.system_key === "string"
                        ? firstSegment.config.system_key
                        : null,
                    segments: segments.slice(1).map((segment) => ({
                      reps: asText(segment.reps),
                      weight: asText(segment.weight),
                      rpe: asText(segment.rpe),
                      restAfterSeconds: asText(segment.rest_after_seconds),
                      rangeOfMotion: segment.range_of_motion ?? "full",
                    })),
                    config: firstSegment.config ?? {},
                  }
                : undefined,
          };
        }),
      };
    }),
  };
}

export async function findDuplicateLogClient(data: DuplicateLogInput) {
  const person = await requirePerson();
  const rows = await supabasePublicSelect<{ id: string }>("sessions", {
    select: "id",
    person_id: `eq.${person.id}`,
    session_date: `eq.${data.date}`,
    title: `eq.${data.title}`,
    limit: 1,
  });
  return rows[0] ?? null;
}

export async function addWorkoutSessionClient(
  data: WorkoutSessionInput,
  options: { queueWhenOffline?: boolean } = {},
) {
  const person = await requirePerson();
  data.entries.forEach((entry) => validatedFeel(entry.feel));
  const entries = data.entries.filter((entry) => entry.exercise.trim());
  if (!entries.length) throw new Error("Add at least one movement.");
  const singleSetlessEntry = entries.length === 1 && isSetlessActivity([entries[0]?.workoutType]);
  const rpe = toNum(data.rpe) ?? (singleSetlessEntry ? toNum(entries[0]?.rpe) : null);
  const durationMinutes =
    toNum(data.duration) ?? (singleSetlessEntry ? toNum(entries[0]?.duration) : null);
  for (const entry of entries) {
    if (entry.workoutType !== "Climbing") continue;
    const issue = climbingMetricIssue({
      minutes: entry.duration,
      trackingMode: entry.climbingTrackingMode,
      problemsOrRoutes: entry.climbingBoulders,
    });
    if (issue) throw new Error(`${entry.exercise}: ${issue}`);
  }

  const rpcEntries = await Promise.all(
    entries.map(async (entryData, index) => {
      const [activityType, exercise] = await Promise.all([
        getOrCreateActivityType(entryData.workoutType || "Other"),
        findExercise(entryData.exercise),
      ]);
      const activityTypeId = exercise?.activity_type_id ?? activityType?.id ?? null;
      if (!activityTypeId) throw new Error(`${entryData.exercise} needs an activity type.`);
      const setlessActivity = isSetlessActivity([
        entryData.workoutType,
        activityType?.name,
        exercise?.activity_types?.name,
      ]);
      const entryKind =
        entryData.entryKind ||
        (entryData.workoutType === SKILL_WORKOUT_TYPE
          ? "Skill"
          : entryData.workoutType === GRIP_WORKOUT_TYPE
            ? GRIP_WORKOUT_TYPE
            : "Workout");
      const explicitSets = (entryData.setRows ?? []).filter(
        (set) => set.reps || set.weight || set.durationSeconds || set.rpe || set.method,
      );
      const rawSets = setlessActivity
        ? []
        : explicitSets.length > 0
          ? explicitSets.map((set, setIndex) => ({
              set,
              setNumber: setIndex + 1,
              dataShape: "individual" as const,
              aggregateSetCount: null,
            }))
          : [
              {
                set: {
                  reps: entryData.reps,
                  weight: entryData.weight,
                  durationSeconds: entryData.holdSeconds,
                  rpe: entryData.rpe,
                  completed: entryData.completed,
                  method: undefined,
                },
                setNumber: 1,
                dataShape:
                  (toNum(entryData.sets) ?? 1) > 1
                    ? ("aggregate" as const)
                    : ("individual" as const),
                aggregateSetCount: (toNum(entryData.sets) ?? 1) > 1 ? toNum(entryData.sets) : null,
              },
            ];
      const sets = rawSets.map(({ set, setNumber, dataShape, aggregateSetCount }) => {
        const weight = toNum(set.weight);
        const classification =
          entryData.loadSemantics && weight != null && weight > 0
            ? explicitLoadClassification(entryData.loadSemantics)
            : {
                ...inferLoadClassification({
                  movement: entryData.exercise,
                  equipment: exercise?.equipment ?? null,
                  weight,
                  assistanceType: entryData.assistanceType,
                }),
                implementCount: null,
              };
        const methodSegments =
          set.method && set.method.segments.length > 0
            ? [
                {
                  reps: set.reps,
                  weight: set.weight,
                  rpe: set.rpe,
                  restAfterSeconds: "0",
                  rangeOfMotion: String(set.method.config.base_range_of_motion ?? "full"),
                },
                ...set.method.segments,
              ].map((segment, segmentIndex) => ({
                training_method_id: set.method?.trainingMethodId,
                method_name: set.method?.methodName,
                segment_index: segmentIndex,
                reps: toNum(segment.reps),
                weight: toNum(segment.weight),
                rpe: toNum(segment.rpe),
                rest_after_seconds: toNum(segment.restAfterSeconds),
                range_of_motion: segment.rangeOfMotion || null,
                config: set.method?.config ?? {},
              }))
            : [];
        return {
          set_number: setNumber,
          reps: toNum(set.reps),
          weight,
          duration_seconds: toNum(set.durationSeconds),
          distance: explicitSets.length ? null : toNum(entryData.distance),
          distance_unit: explicitSets.length ? null : entryData.distanceUnit || null,
          rpe: toNum(set.rpe) ?? rpe,
          rest_time: entryData.restTime || null,
          assistance_type: entryData.assistanceType || null,
          assistance_detail: entryData.assistanceDetail || null,
          quality: entryData.quality || null,
          completed: set.completed,
          notes: entryData.notes || null,
          data_shape: dataShape,
          aggregate_set_count: aggregateSetCount,
          load_semantics: classification.loadSemantics,
          volume_status: classification.volumeStatus,
          implement_count: classification.implementCount,
          segments: methodSegments,
        };
      });
      const metrics = [
        {
          metric_key: "duration_minutes",
          metric_value: toNum(entryData.duration),
          metric_unit: entryData.duration ? "min" : null,
        },
        {
          metric_key: "rpe",
          metric_value: setlessActivity ? (toNum(entryData.rpe) ?? rpe) : null,
        },
        { metric_key: "rounds", metric_value: toNum(entryData.rounds) },
        { metric_key: "feel", metric_value: validatedFeel(entryData.feel) },
        {
          metric_key: "pain",
          metric_value:
            entryData.pain.trim() === ""
              ? null
              : Math.min(10, Math.max(0, toNum(entryData.pain) ?? 0)),
        },
        {
          metric_key: "technique",
          metric_text:
            entryData.technique === "good" ||
            entryData.technique === "acceptable" ||
            entryData.technique === "poor"
              ? entryData.technique
              : null,
        },
        { metric_key: "height", metric_value: toNum(entryData.height), metric_unit: "cm" },
        {
          metric_key: "position_measurement",
          metric_value: toNum(entryData.positionMeasurementCm),
          metric_unit: entryData.positionMeasurementCm ? "cm" : null,
        },
        {
          metric_key: "position_measurement_setup",
          metric_text: entryData.positionMeasurementSetup || null,
        },
        { metric_key: "detail", metric_text: entryData.detail || null },
        {
          metric_key: "tracking_mode",
          metric_text:
            entryData.workoutType === "Climbing"
              ? entryData.climbingTrackingMode ||
                (entryData.climbingBoulders ? "Problems / routes" : "Time only")
              : null,
        },
        {
          metric_key: "boulders",
          metric_value:
            entryData.workoutType === "Climbing" &&
            entryData.climbingTrackingMode === "Problems / routes"
              ? toNum(entryData.climbingBoulders)
              : null,
        },
        {
          metric_key: "grade",
          metric_text:
            entryData.workoutType === "Climbing" ? entryData.climbingMaxGrade || null : null,
        },
        {
          metric_key: "grade_system",
          metric_text:
            entryData.workoutType === "Climbing" &&
            entryData.climbingTrackingMode === "Problems / routes"
              ? entryData.climbingGradeSystem || null
              : null,
        },
        {
          metric_key: "send_type",
          metric_text:
            entryData.workoutType === "Climbing" &&
            entryData.climbingTrackingMode === "Problems / routes"
              ? entryData.climbingSendType || null
              : null,
        },
        {
          metric_key: "is_project",
          metric_value:
            entryData.workoutType === "Climbing" &&
            entryData.climbingTrackingMode === "Problems / routes" &&
            entryData.climbingIsProject
              ? 1
              : null,
        },
        {
          metric_key: "gradient",
          metric_text:
            entryData.workoutType === "Climbing" && supportsClimbingGradient(entryData.exercise)
              ? entryData.climbingGradient || null
              : null,
        },
      ].filter((metric) => metric.metric_value != null || metric.metric_text);
      return {
        client_id: entryData.clientId ?? `entry-${index}`,
        exercise_id: exercise?.id ?? null,
        activity_type_id: activityTypeId,
        entry_kind: entryKind,
        name: entryData.exercise,
        progression_level: entryData.progressionLevel || null,
        order_index: index,
        completed: entryData.completed,
        notes: entryData.notes || null,
        sets,
        metrics,
      };
    }),
  );

  const methodBlocks = (data.methodBlocks ?? [])
    .filter((block) => block.memberClientIds.length >= (block.family === "timed_density" ? 1 : 2))
    .map((block, index) => ({
      training_method_id: block.trainingMethodId,
      method_name: block.methodName,
      family: block.family,
      order_index: index,
      rounds: toNum(block.rounds),
      rest_between_movements_seconds: toNum(block.restBetweenMovementsSeconds),
      rest_between_rounds_seconds: toNum(block.restBetweenRoundsSeconds),
      block_duration_seconds:
        toNum(block.blockDurationMinutes) == null
          ? null
          : Math.round(Number(block.blockDurationMinutes) * 60),
      work_interval_seconds: toNum(block.workIntervalSeconds),
      rest_interval_seconds: toNum(block.restIntervalSeconds),
      completed_rounds: toNum(block.completedRounds),
      member_client_ids: block.memberClientIds,
      config: block.config,
    }));

  const rpcBody = {
    p_person_id: person.id,
    p_session: {
      activity_type_id: null,
      session_date: data.date,
      title: data.title.trim() || "Workout",
      completed: data.completed,
      duration_minutes: durationMinutes,
      intensity: data.intensity || null,
      rpe,
      notes: data.notes || null,
      training_location_id: data.trainingLocationId || null,
    },
    p_entries: rpcEntries,
    p_method_blocks: methodBlocks,
  };

  try {
    const sessionId = await supabasePublicRpc<string>("save_workout", rpcBody);
    if (!sessionId) throw new Error("Workout was not saved.");
    return { ok: true, row: "Supabase", sessionId, queued: false as const };
  } catch (error) {
    if (!options.queueWhenOffline || !isLikelyOfflineError(error)) throw error;
    enqueueWorkoutSave({
      personId: person.id,
      rpcBody,
      draftKey: workoutSessionDraftKey(),
    });
    return { ok: true, row: "Offline queue", sessionId: null, queued: true as const };
  }
}

export async function replaceWorkoutSessionClient(
  originalSessionId: string,
  data: WorkoutSessionInput,
) {
  if (!originalSessionId) throw new Error("Missing workout session id.");
  const person = await requirePerson();
  const originals = await supabasePublicSelect<{ id: string }>("sessions", {
    select: "id",
    id: `eq.${originalSessionId}`,
    person_id: `eq.${person.id}`,
    limit: 1,
  });
  if (!originals[0]) throw new Error("The original workout could not be found.");

  const linkedPlans = await supabasePublicSelect<{ id: string }>("suggested_workouts", {
    select: "id",
    person_id: `eq.${person.id}`,
    completed_session_id: `eq.${originalSessionId}`,
  });
  const replacement = await addWorkoutSessionClient(data, { queueWhenOffline: false });

  try {
    const deleted = await supabasePublicDelete<{ id: string }>("sessions", {
      id: `eq.${originalSessionId}`,
      person_id: `eq.${person.id}`,
    });
    if (!deleted.some((session) => session.id === originalSessionId)) {
      throw new Error("The original workout was not removed, so the correction was cancelled.");
    }
  } catch (error) {
    await supabasePublicDelete("sessions", { id: `eq.${replacement.sessionId}` }).catch(
      () => undefined,
    );
    throw error;
  }

  let planRelinkFailed = false;
  for (const plan of linkedPlans) {
    try {
      const updated = await supabasePublicUpdate<{ id: string }>(
        "suggested_workouts",
        { id: `eq.${plan.id}`, person_id: `eq.${person.id}` },
        { status: "completed", completed_session_id: replacement.sessionId },
      );
      if (!updated.some((workout) => workout.id === plan.id)) planRelinkFailed = true;
    } catch {
      planRelinkFailed = true;
    }
  }

  return { ...replacement, replacedSessionId: originalSessionId, planRelinkFailed };
}

export async function deleteSessionClient(id: string) {
  if (!id) throw new Error("Missing session id.");
  const person = await requirePerson();
  const linkedPlans = await supabasePublicSelect<{ id: string }>("suggested_workouts", {
    select: "id",
    person_id: `eq.${person.id}`,
    completed_session_id: `eq.${id}`,
  });
  if (linkedPlans.length) {
    const updated = await supabasePublicUpdate<{ id: string }>(
      "suggested_workouts",
      { person_id: `eq.${person.id}`, completed_session_id: `eq.${id}` },
      { status: "archived", completed_session_id: null },
    );
    const updatedIds = new Set(updated.map((row) => row.id));
    if (linkedPlans.some((plan) => !updatedIds.has(plan.id))) {
      throw new Error("The linked workout plan could not be archived, so nothing was deleted.");
    }
  }
  try {
    const deleted = await supabasePublicDelete<{ id: string }>("sessions", {
      id: `eq.${id}`,
      person_id: `eq.${person.id}`,
    });
    if (!deleted.some((session) => session.id === id)) {
      throw new Error("The workout session was not deleted.");
    }
  } catch (error) {
    if (linkedPlans.length) {
      await supabasePublicUpdate(
        "suggested_workouts",
        {
          id: `in.(${linkedPlans.map((plan) => plan.id).join(",")})`,
          person_id: `eq.${person.id}`,
        },
        { status: "completed", completed_session_id: id },
      ).catch(() => undefined);
    }
    throw error;
  }
  return { ok: true };
}

function estimateOneRM(
  weight: number | null,
  reps: number | null,
  formula = ONE_RM_DEFAULT_FORMULA,
) {
  if (weight == null || reps == null || reps <= 0) return null;
  if (reps === 1) return Math.round(weight * 10) / 10;
  const estimated =
    formula.toLowerCase() === "brzycki"
      ? weight * (36 / Math.max(1, 37 - reps))
      : weight * (1 + reps / 30);
  return Math.round(estimated * 10) / 10;
}

export async function get1RMRecentClient() {
  await requirePerson();
  const [tests, bodyweight] = await Promise.all([
    supabasePublicSelect<OneRMRecord>("one_rm_tests", {
      select:
        "id,test_date,source,exercise_name,load_type,external_weight,reps,rpe,estimated_total,estimated_external,is_pr",
      order: "test_date.desc,created_at.desc",
      limit: 15,
    }),
    supabasePublicSelect<BodyweightRecord>("bodyweight_logs", {
      select: "id,logged_date,bodyweight,notes",
      order: "logged_date.desc,created_at.desc",
      limit: 10,
    }),
  ]);

  return {
    recent: tests.map((row) => ({
      date: row.test_date,
      id: row.id,
      source: row.source ?? "",
      exercise: row.exercise_name,
      type: row.load_type ?? "",
      externalWeight: asText(row.external_weight),
      reps: asText(row.reps),
      rpe: asText(row.rpe),
      estTotal: asText(row.estimated_total),
      estExternal: asText(row.estimated_external),
      pr: row.is_pr,
    })),
    bodyweight: bodyweight.map((row) => ({
      date: row.logged_date,
      id: row.id,
      bodyweight: asText(row.bodyweight),
      notes: row.notes ?? "",
    })),
    latestBodyweight: asText(bodyweight[0]?.bodyweight),
  };
}

export async function delete1RMTestClient(id: string) {
  if (!id) throw new Error("Missing 1RM test id.");
  await supabasePublicDelete("one_rm_tests", { id: `eq.${id}` });
  return { ok: true };
}

export async function deleteBodyweightClient(id: string) {
  if (!id) throw new Error("Missing bodyweight id.");
  await supabasePublicDelete("bodyweight_logs", { id: `eq.${id}` });
  return { ok: true };
}

export async function add1RMTestClient(data: OneRMInput) {
  const person = await requirePerson();
  const externalWeight = toNum(data.externalWeight);
  const reps = toNum(data.reps);
  const formula = data.formula || ONE_RM_DEFAULT_FORMULA;
  const estimatedExternal = estimateOneRM(externalWeight, reps, formula);
  const estimatedTotal = estimatedExternal;

  const prior = await supabasePublicSelect<
    Pick<OneRMRecord, "estimated_total" | "estimated_external" | "external_weight">
  >("one_rm_tests", {
    select: "estimated_total,estimated_external,external_weight",
    exercise_name: `eq.${data.exercise}`,
    order: "estimated_total.desc",
    limit: 1,
  });
  const priorBest = toNum(
    prior[0]?.estimated_total ?? prior[0]?.estimated_external ?? prior[0]?.external_weight,
  );
  const nextBest = estimatedTotal ?? estimatedExternal ?? externalWeight;
  const isPr = nextBest != null && (priorBest == null || nextBest > priorBest);

  const inserted = await supabasePublicInsert<{ source_row: number | null }>("one_rm_tests", {
    person_id: person.id,
    test_date: data.date,
    exercise_name: data.exercise,
    source: data.source || null,
    load_type: data.type || null,
    bodyweight_used: data.bodyweightUsed,
    bodyweight_contribution: data.bodyweightUsed ? data.bwContribution || null : null,
    external_weight: externalWeight,
    reps,
    rpe: toNum(data.rpe),
    formula,
    estimated_total: estimatedTotal,
    estimated_external: estimatedExternal,
    is_pr: isPr,
  });
  return { ok: true, row: inserted[0]?.source_row ?? "Supabase" };
}

export async function addBodyweightClient(data: BodyweightInput) {
  const person = await requirePerson();
  const bodyweight = toNum(data.bodyweight);
  if (bodyweight == null) throw new Error("Enter a bodyweight.");
  const inserted = await supabasePublicInsert<{ source_row: number | null }>("bodyweight_logs", {
    person_id: person.id,
    logged_date: data.date,
    bodyweight,
    notes: data.notes || null,
  });
  return { ok: true, row: inserted[0]?.source_row ?? "Supabase" };
}

export async function getPRsClient() {
  await requirePerson();
  const [tests, skills] = await Promise.all([
    supabasePublicSelect<OneRMRecord>("one_rm_tests", {
      select:
        "id,test_date,source,exercise_name,load_type,external_weight,reps,rpe,estimated_total,estimated_external,is_pr",
      is_pr: "eq.true",
      order: "exercise_name.asc,test_date.desc",
      limit: 200,
    }),
    supabasePublicSelect<SessionEntryRecord>("session_entries", {
      select:
        "id,entry_kind,name,progression_level,completed,notes,entry_sets(set_number,reps,duration_seconds,assistance_type,assistance_detail),sessions!inner(id,session_date,completed,source_sheet,activity_types(name))",
      completed: "eq.true",
      "sessions.completed": "eq.true",
      limit: 1000,
    }),
  ]);

  const oneRmByExercise = new Map<string, OneRMRecord>();
  for (const row of tests) {
    const current = oneRmByExercise.get(row.exercise_name);
    const currentValue = toNum(
      current?.estimated_total ?? current?.estimated_external ?? current?.external_weight,
    );
    const nextValue = toNum(row.estimated_total ?? row.estimated_external ?? row.external_weight);
    if (nextValue != null && (currentValue == null || nextValue > currentValue)) {
      oneRmByExercise.set(row.exercise_name, row);
    }
  }

  type SkillPR = {
    skill: string;
    progression: string;
    metric: "hold" | "reps";
    value: number;
    unit: string;
    date: string;
    assistance: "assisted" | "unassisted";
    assistanceLabel: string;
    assistanceAmount?: number | null;
  };
  const skillBest = new Map<string, SkillPR>();
  const isBetterSkillPR = (
    value: number,
    assistanceAmount: number | null,
    assisted: boolean,
    current: SkillPR | undefined,
  ) => {
    if (!current) return true;
    if (value !== current.value) return value > current.value;
    if (assisted !== (current.assistance === "assisted")) return !assisted;
    if (assistanceAmount != null && current.assistanceAmount != null) {
      return assistanceAmount < current.assistanceAmount;
    }
    return false;
  };

  for (const row of skills) {
    const workoutType = row.activity_types?.name ?? row.sessions?.activity_types?.name ?? "";
    if (row.entry_kind !== "Skill" && workoutType !== SKILL_WORKOUT_TYPE) continue;
    const setRows = row.entry_sets ?? [];
    const set = setRows[0];
    const assistanceType = (set?.assistance_type ?? "").trim();
    const assistanceDetail = (set?.assistance_detail ?? "").trim();
    const assisted =
      Boolean(assistanceType && assistanceType.toLowerCase() !== "none") ||
      Boolean(assistanceDetail);
    const assistanceLabel = [assisted ? assistanceType : "", assistanceDetail]
      .filter(Boolean)
      .join(" · ");
    const assistanceAmount = toNum(assistanceDetail || assistanceType);
    const base = {
      skill: row.name,
      progression: row.progression_level ?? "",
      date: row.sessions?.session_date ?? "",
      assistance: assisted ? ("assisted" as const) : ("unassisted" as const),
      assistanceLabel,
      assistanceAmount,
    };
    const consider = (metric: "hold" | "reps", value: number, unit: string) => {
      const key = `${movementKey(base.skill)}::${metric}`;
      const current = skillBest.get(key);
      if (!isBetterSkillPR(value, assistanceAmount ?? null, assisted, current)) return;
      skillBest.set(key, { ...base, metric, value, unit });
    };
    const hold = setRows.reduce<number | null>((max, item) => {
      const value = toNum(item.duration_seconds);
      return value == null || (max != null && max >= value) ? max : value;
    }, null);
    const reps =
      setRows.length > 1
        ? setRows.reduce<number | null>((max, item) => {
            const value = toNum(item.reps);
            return value == null || (max != null && max >= value) ? max : value;
          }, null)
        : repsPerSet(toNum(set?.reps), toNum(set?.set_number));
    if (hold != null && hold > 0) consider("hold", hold, "s");
    if (reps != null && reps > 0) consider("reps", reps, "reps");
  }

  return {
    oneRm: Array.from(oneRmByExercise.values())
      .map((row) => ({
        exercise: row.exercise_name,
        date: row.test_date,
        type: row.load_type ?? "",
        externalWeight: asText(row.external_weight),
        reps: asText(row.reps),
        estTotal: asText(row.estimated_total),
        estExternal: asText(row.estimated_external),
      }))
      .sort((a, b) => a.exercise.localeCompare(b.exercise)),
    skills: Array.from(skillBest.values())
      .map((row) => {
        const { assistanceAmount, ...publicRow } = row;
        void assistanceAmount;
        return publicRow;
      })
      .sort(
        (a, b) =>
          a.skill.localeCompare(b.skill) ||
          a.progression.localeCompare(b.progression) ||
          a.metric.localeCompare(b.metric),
      ),
  };
}
