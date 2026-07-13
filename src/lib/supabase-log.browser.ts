import {
  supabasePublicDelete,
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import { claimNoamProfile, getCurrentPerson } from "./supabase-people.browser";

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
  activity_type_id: string | null;
  activity_types: { name: string | null } | null;
};

type PersonExerciseRecord = {
  exercise_id: string;
  is_enabled: boolean;
  location_scope: "home" | "gym" | "both";
};

type EntrySetRecord = {
  set_number: number | string | null;
  reps: number | string | null;
  weight: number | string | null;
  duration_seconds: number | string | null;
  rpe: number | string | null;
  rest_time: string | null;
  assistance_type: string | null;
  assistance_detail: string | null;
  quality: string | null;
  completed: boolean | null;
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

type SessionRecord = {
  id: string;
  session_date: string;
  title: string | null;
  completed: boolean;
  duration_minutes: number | string | null;
  intensity: string | null;
  rpe: number | string | null;
  notes: string | null;
  activity_types: { name: string | null } | null;
  session_entries: SessionEntryRecord[] | null;
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
  distance: string;
  distanceUnit: string;
  rounds: string;
  feel: string;
  height: string;
  detail: string;
  setRows?: WorkoutSetInput[];
};

export type WorkoutSetInput = {
  reps: string;
  weight: string;
  rpe: string;
  completed: boolean;
};

export type TrainingLocation = {
  id: string;
  name: string;
  kind: "home" | "gym" | "other";
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

function hasMetricValue(metric: {
  metric_value?: number | null;
  metric_text?: string | null;
  metric_unit?: string | null;
}) {
  return (
    metric.metric_value != null ||
    Boolean(metric.metric_text?.trim()) ||
    Boolean(metric.metric_unit?.trim())
  );
}

function metricRow(metric: {
  session_entry_id: string;
  metric_key: string;
  metric_value?: number | null;
  metric_text?: string | null;
  metric_unit?: string | null;
}) {
  return {
    session_entry_id: metric.session_entry_id,
    metric_key: metric.metric_key,
    metric_value: metric.metric_value ?? null,
    metric_text: metric.metric_text ?? null,
    metric_unit: metric.metric_unit ?? null,
  };
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

async function listActivityTypes() {
  return supabasePublicSelect<ActivityTypeRecord>("activity_types", {
    select: "id,name,slug,sort_order",
    order: "sort_order.asc,name.asc",
  });
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
  const [activityTypes, exercises, personExercises] = await Promise.all([
    listActivityTypes(),
    supabasePublicSelect<ExerciseRecord>("exercises", {
      select:
        "id,focus_area,name,equipment,default_metric,suggested_sets,suggested_reps,notes,activity_type_id,activity_types(name)",
      is_active: "eq.true",
      order: "source_row.asc,name.asc",
      limit: 1000,
    }),
    supabasePublicSelect<PersonExerciseRecord>("person_exercises", {
      select: "exercise_id,is_enabled,location_scope",
      person_id: `eq.${person.id}`,
    }),
  ]);
  const enabledExercises = new Set(
    personExercises.filter((row) => row.is_enabled).map((row) => row.exercise_id),
  );
  const availableExercises = exercises.filter((row) => enabledExercises.has(row.id));

  const workoutTypes = activityTypes
    .map((type) => type.name)
    .filter((name, index, all) => {
      if (!name || all.indexOf(name) !== index) return false;
      if (name === "Bouldering" || name === "Sport") return false;
      return availableExercises.some((row) => row.activity_types?.name === name);
    });

  return {
    exercises: availableExercises.map((row) => ({
      id: row.id,
      workoutType: row.activity_types?.name ?? "",
      focusArea: row.focus_area ?? "",
      name: row.name,
      equipment: row.equipment ?? "",
      metric: row.default_metric ?? "",
      suggestedSets: row.suggested_sets ?? "",
      suggestedReps: row.suggested_reps ?? "",
      notes: row.notes ?? "",
      locationScope:
        personExercises.find((personExercise) => personExercise.exercise_id === row.id)
          ?.location_scope ?? "both",
    })),
    workoutTypes,
    focusAreas: Array.from(
      new Set(availableExercises.map((row) => row.focus_area ?? "").filter(Boolean)),
    ),
    ...FALLBACK_SETTINGS,
  };
}

export async function getTrainingLocationsClient(): Promise<TrainingLocation[]> {
  const person = await requirePerson();
  const rows = await supabasePublicSelect<{
    id: string;
    name: string;
    kind: "home" | "gym" | "other";
  }>("training_locations", {
    select: "id,name,kind",
    person_id: `eq.${person.id}`,
    is_active: "eq.true",
    order: "kind.asc,name.asc",
  });
  return rows;
}

function firstSet(entry: SessionEntryRecord) {
  return entry.entry_sets?.[0];
}

function metricValue(metrics: EntryMetricRecord[] | null | undefined, key: string) {
  const row = metrics?.find((metric) => metric.metric_key === key);
  return asText(row?.metric_text ?? row?.metric_value);
}

export async function getRecentLogsClient(limit = 15) {
  await requirePerson();
  const rows = await supabasePublicSelect<SessionEntryRecord>("session_entries", {
    select:
      "id,order_index,entry_kind,name,progression_level,completed,notes,source_sheet,exercises(name,focus_area,activity_types(name)),activity_types(name),entry_sets(set_number,reps,weight,duration_seconds,rpe,rest_time,assistance_type,assistance_detail,quality,completed),sessions!inner(id,session_date,title,completed,duration_minutes,intensity,rpe,notes,source_sheet,activity_types(name),training_locations(id,name,kind))",
    "sessions.source_sheet": "eq.Workout Log",
    order: "created_at.desc",
    limit: Math.min(Math.max(Math.round(limit), 1), 500),
  });

  return {
    recent: rows.map((row) => {
      const sets = [...(row.entry_sets ?? [])].sort(
        (a, b) => Number(a.set_number ?? 0) - Number(b.set_number ?? 0),
      );
      const set = sets[0];
      const individualSets = sets.length > 1;
      const totalReps = individualSets
        ? sets.reduce((total, item) => total + (toNum(item.reps) ?? 0), 0)
        : toNum(set?.reps);
      const maxWeight = sets.reduce<number | null>((max, item) => {
        const weight = toNum(item.weight);
        return weight == null || (max != null && max >= weight) ? max : weight;
      }, null);
      return {
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
        sets: asText(individualSets ? sets.length : set?.set_number),
        reps: asText(totalReps),
        weight: asText(maxWeight ?? set?.weight),
        duration: asText(row.sessions?.duration_minutes),
        intensity: row.sessions?.intensity ?? "",
        rpe: asText(set?.rpe ?? row.sessions?.rpe),
        restTime: set?.rest_time ?? "",
        completed: row.completed && Boolean(row.sessions?.completed),
        notes: row.notes ?? row.sessions?.notes ?? "",
        entryKind: row.entry_kind ?? "",
        progressionLevel: row.progression_level ?? "",
        holdSeconds: asText(set?.duration_seconds),
        assistanceType: set?.assistance_type ?? "",
        assistanceDetail: set?.assistance_detail ?? "",
        quality: set?.quality ?? "",
        trainingLocation: row.sessions?.training_locations ?? null,
        setRows: sets.map((item) => ({
          reps: asText(item.reps),
          weight: asText(item.weight),
          rpe: asText(item.rpe),
          completed: item.completed !== false,
        })),
      };
    }),
  };
}

export async function findDuplicateLogClient(data: DuplicateLogInput) {
  await requirePerson();
  const rows = await supabasePublicSelect<{ id: string }>("sessions", {
    select: "id",
    session_date: `eq.${data.date}`,
    title: `eq.${data.title}`,
    source_sheet: `eq.${data.sourceSheet}`,
    limit: 1,
  });
  return rows[0] ?? null;
}

export async function addWorkoutClient(data: WorkoutLogInput) {
  const person = await requirePerson();
  const [activityType, exercise] = await Promise.all([
    getOrCreateActivityType(data.workoutType || "Other"),
    findExercise(data.exercise),
  ]);
  const durationMinutes = toNum(data.duration);
  const rpe = toNum(data.rpe);
  const insertedSession = await supabasePublicInsert<{ id: string; source_row: number | null }>(
    "sessions",
    {
      person_id: person.id,
      activity_type_id: activityType?.id ?? exercise?.activity_type_id ?? null,
      session_date: data.date,
      title: data.exercise,
      source: "manual",
      completed: data.completed,
      duration_minutes: durationMinutes,
      intensity: data.intensity || null,
      rpe,
      notes: data.notes || null,
      source_sheet: "Workout Log",
    },
  );
  const session = insertedSession[0];
  if (!session) throw new Error("Workout was not saved.");

  try {
    const entryKind =
      data.entryKind ||
      (data.workoutType === SKILL_WORKOUT_TYPE
        ? "Skill"
        : data.workoutType === GRIP_WORKOUT_TYPE
          ? GRIP_WORKOUT_TYPE
          : "Workout");
    const insertedEntry = await supabasePublicInsert<{ id: string }>("session_entries", {
      session_id: session.id,
      exercise_id: exercise?.id ?? null,
      activity_type_id: activityType?.id ?? exercise?.activity_type_id ?? null,
      entry_kind: entryKind,
      name: data.exercise,
      progression_level: data.progressionLevel || null,
      order_index: 0,
      completed: data.completed,
      notes: data.notes || null,
      source_sheet: "Workout Log",
    });
    const entry = insertedEntry[0];
    if (!entry) throw new Error("Workout entry was not saved.");

    const holdSeconds = toNum(data.holdSeconds);
    const distance = toNum(data.distance);
    await supabasePublicInsert("entry_sets", {
      session_entry_id: entry.id,
      set_number: toNum(data.sets),
      reps: toNum(data.reps),
      weight: toNum(data.weight),
      duration_seconds: holdSeconds,
      distance,
      distance_unit: data.distanceUnit || null,
      rpe,
      rest_time: data.restTime || null,
      assistance_type: data.assistanceType || null,
      assistance_detail: data.assistanceDetail || null,
      quality: data.quality || null,
      completed: data.completed,
      notes: data.notes || null,
    });

    const metrics = [
      { metric_key: "rounds", metric_value: toNum(data.rounds) },
      { metric_key: "feel", metric_value: toNum(data.feel) },
      { metric_key: "height", metric_value: toNum(data.height), metric_unit: "cm" },
      { metric_key: "detail", metric_text: data.detail || null },
    ].filter((metric) => metric.metric_value != null || metric.metric_text);
    if (metrics.length) {
      await supabasePublicInsert(
        "entry_metrics",
        metrics.map((metric) =>
          metricRow({
            session_entry_id: entry.id,
            ...metric,
          }),
        ),
      );
    }
  } catch (error) {
    await supabasePublicDelete("sessions", { id: `eq.${session.id}` }).catch(() => undefined);
    throw error;
  }

  return { ok: true, row: session.source_row ?? "Supabase" };
}

export async function addWorkoutSessionClient(data: WorkoutSessionInput) {
  const person = await requirePerson();
  const rpe = toNum(data.rpe);
  const durationMinutes = toNum(data.duration);
  const entries = data.entries.filter((entry) => entry.exercise.trim());
  if (!entries.length) throw new Error("Add at least one movement.");

  const insertedSession = await supabasePublicInsert<{ id: string; source_row: number | null }>(
    "sessions",
    {
      person_id: person.id,
      activity_type_id: null,
      session_date: data.date,
      title: data.title.trim() || "Workout",
      source: "manual",
      completed: data.completed,
      duration_minutes: durationMinutes,
      intensity: data.intensity || null,
      rpe,
      notes: data.notes || null,
      training_location_id: data.trainingLocationId || null,
      source_sheet: "Workout Log",
    },
  );
  const session = insertedSession[0];
  if (!session) throw new Error("Workout was not saved.");

  try {
    for (const [index, entryData] of entries.entries()) {
      const [activityType, exercise] = await Promise.all([
        getOrCreateActivityType(entryData.workoutType || "Other"),
        findExercise(entryData.exercise),
      ]);
      const entryKind =
        entryData.entryKind ||
        (entryData.workoutType === SKILL_WORKOUT_TYPE
          ? "Skill"
          : entryData.workoutType === GRIP_WORKOUT_TYPE
            ? GRIP_WORKOUT_TYPE
            : "Workout");

      const insertedEntry = await supabasePublicInsert<{ id: string }>("session_entries", {
        session_id: session.id,
        exercise_id: exercise?.id ?? null,
        activity_type_id: activityType?.id ?? exercise?.activity_type_id ?? null,
        entry_kind: entryKind,
        name: entryData.exercise,
        progression_level: entryData.progressionLevel || null,
        order_index: index,
        completed: entryData.completed,
        notes: entryData.notes || null,
        source_sheet: "Workout Log",
      });
      const entry = insertedEntry[0];
      if (!entry) throw new Error(`${entryData.exercise} was not saved.`);

      const setRows = (entryData.setRows ?? []).filter((set) => set.reps || set.weight || set.rpe);
      if (setRows.length) {
        await supabasePublicInsert(
          "entry_sets",
          setRows.map((set, setIndex) => ({
            session_entry_id: entry.id,
            set_number: setIndex + 1,
            reps: toNum(set.reps),
            weight: toNum(set.weight),
            rpe: toNum(set.rpe) ?? rpe,
            rest_time: entryData.restTime || null,
            completed: set.completed,
            notes: entryData.notes || null,
          })),
        );
      } else {
        await supabasePublicInsert("entry_sets", {
          session_entry_id: entry.id,
          set_number: toNum(entryData.sets),
          reps: toNum(entryData.reps),
          weight: toNum(entryData.weight),
          duration_seconds: toNum(entryData.holdSeconds),
          distance: toNum(entryData.distance),
          distance_unit: entryData.distanceUnit || null,
          rpe: toNum(entryData.rpe) ?? rpe,
          rest_time: entryData.restTime || null,
          assistance_type: entryData.assistanceType || null,
          assistance_detail: entryData.assistanceDetail || null,
          quality: entryData.quality || null,
          completed: entryData.completed,
          notes: entryData.notes || null,
        });
      }

      const metrics = [
        { metric_key: "rounds", metric_value: toNum(entryData.rounds) },
        { metric_key: "feel", metric_value: toNum(entryData.feel) },
        { metric_key: "height", metric_value: toNum(entryData.height), metric_unit: "cm" },
        { metric_key: "detail", metric_text: entryData.detail || null },
      ].filter((metric) => metric.metric_value != null || metric.metric_text);
      if (metrics.length) {
        await supabasePublicInsert(
          "entry_metrics",
          metrics.map((metric) =>
            metricRow({
              session_entry_id: entry.id,
              ...metric,
            }),
          ),
        );
      }
    }
  } catch (error) {
    await supabasePublicDelete("sessions", { id: `eq.${session.id}` }).catch(() => undefined);
    throw error;
  }

  return { ok: true, row: session.source_row ?? "Supabase", sessionId: session.id };
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
    source_sheet: "eq.Workout Log",
    limit: 1,
  });
  if (!originals[0]) throw new Error("The original workout could not be found.");

  const linkedPlans = await supabasePublicSelect<{ id: string }>("suggested_workouts", {
    select: "id",
    person_id: `eq.${person.id}`,
    completed_session_id: `eq.${originalSessionId}`,
  });
  const replacement = await addWorkoutSessionClient(data);

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
  await supabasePublicDelete("sessions", { id: `eq.${id}` });
  return { ok: true };
}

export async function getRecentClimbsClient() {
  await requirePerson();
  const rows = await supabasePublicSelect<SessionRecord>("sessions", {
    select:
      "id,session_date,title,completed,duration_minutes,intensity,rpe,notes,activity_types(name),session_entries(id,entry_kind,name,progression_level,completed,notes,source_sheet,activity_types(name),entry_metrics(metric_key,metric_value,metric_text,metric_unit))",
    source_sheet: "eq.Climbing Log",
    order: "session_date.desc,created_at.desc",
    limit: 15,
  });
  return {
    recent: rows.map((row) => {
      const entry = row.session_entries?.[0];
      const metrics = entry?.entry_metrics;
      return {
        id: row.id,
        date: row.session_date,
        type: row.title ?? row.activity_types?.name ?? "",
        trackingMode: metricValue(metrics, "tracking_mode"),
        hours: metricValue(metrics, "hours"),
        boulders: metricValue(metrics, "boulders"),
        grade: metricValue(metrics, "grade"),
        gradient: metricValue(metrics, "gradient"),
        intensity: row.intensity ?? "",
        rpe: asText(row.rpe),
        completed: row.completed,
        notes: row.notes ?? "",
      };
    }),
  };
}

export async function addClimbClient(data: ClimbLogInput) {
  const person = await requirePerson();
  const activityType = await getOrCreateActivityType(data.type || "Climbing");
  const movement = data.movement || data.type || "Climbing";
  const hours = toNum(data.hours);
  const rpe = toNum(data.rpe);
  const insertedSession = await supabasePublicInsert<{ id: string; source_row: number | null }>(
    "sessions",
    {
      person_id: person.id,
      activity_type_id: activityType?.id ?? null,
      session_date: data.date,
      title: movement,
      source: "manual",
      completed: data.completed,
      duration_minutes: hours == null ? null : hours * 60,
      intensity: data.intensity || null,
      rpe,
      notes: data.notes || null,
      source_sheet: "Climbing Log",
    },
  );
  const session = insertedSession[0];
  if (!session) throw new Error("Climb was not saved.");

  try {
    const insertedEntry = await supabasePublicInsert<{ id: string }>("session_entries", {
      session_id: session.id,
      activity_type_id: activityType?.id ?? null,
      entry_kind: "Climbing",
      name: movement,
      order_index: 0,
      completed: data.completed,
      notes: data.notes || null,
      source_sheet: "Climbing Log",
    });
    const entry = insertedEntry[0];
    if (!entry) throw new Error("Climb entry was not saved.");

    const metrics = [
      {
        session_entry_id: entry.id,
        metric_key: "tracking_mode",
        metric_text: data.trackingMode || null,
      },
      {
        session_entry_id: entry.id,
        metric_key: "hours",
        metric_value: hours,
        metric_unit: hours == null ? null : "h",
      },
      { session_entry_id: entry.id, metric_key: "boulders", metric_value: toNum(data.boulders) },
      { session_entry_id: entry.id, metric_key: "grade", metric_text: data.grade || null },
      { session_entry_id: entry.id, metric_key: "gradient", metric_text: data.gradient || null },
    ]
      .map(metricRow)
      .filter(hasMetricValue);
    if (metrics.length) await supabasePublicInsert("entry_metrics", metrics);
  } catch (error) {
    await supabasePublicDelete("sessions", { id: `eq.${session.id}` }).catch(() => undefined);
    throw error;
  }

  return { ok: true, row: session.source_row ?? "Supabase" };
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
      .map(({ assistanceAmount, ...row }) => row)
      .sort(
        (a, b) =>
          a.skill.localeCompare(b.skill) ||
          a.progression.localeCompare(b.progression) ||
          a.metric.localeCompare(b.metric),
      ),
  };
}
