import { supabasePublicInsert, supabasePublicSelect } from "./supabase-public";
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
export const ONE_RM_FORMULAS = ["Brzycki", "Epley"];

const SKILL_WORKOUT_TYPE = "Skills/Calisthenics";
const GRIP_WORKOUT_TYPE = "Grip";

const FALLBACK_SETTINGS = {
  intensities: ["Low", "Moderate", "High", "Max"],
  climbingTypes: ["Climbing", "Bouldering"],
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
};

type EntryMetricRecord = {
  metric_key: string;
  metric_value: number | string | null;
  metric_text: string | null;
  metric_unit: string | null;
};

type SessionEntryRecord = {
  id: string;
  entry_kind: string | null;
  name: string;
  progression_level: string | null;
  completed: boolean;
  notes: string | null;
  source_sheet: string | null;
  exercises: { name: string | null; focus_area: string | null; activity_types: { name: string | null } | null } | null;
  activity_types: { name: string | null } | null;
  entry_sets: EntrySetRecord[] | null;
  entry_metrics: EntryMetricRecord[] | null;
  sessions: {
    session_date: string;
    title: string | null;
    completed: boolean;
    duration_minutes: number | string | null;
    intensity: string | null;
    rpe: number | string | null;
    notes: string | null;
    source_sheet: string | null;
    activity_types: { name: string | null } | null;
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
};

export type ClimbLogInput = {
  date: string;
  type: string;
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
    select: "id,focus_area,name,equipment,default_metric,suggested_sets,suggested_reps,notes,activity_type_id,activity_types(name)",
    name: `eq.${name.trim()}`,
    is_active: "eq.true",
    limit: 1,
  });
  return rows[0] ?? null;
}

export async function getLibraryClient() {
  const [activityTypes, exercises] = await Promise.all([
    listActivityTypes(),
    supabasePublicSelect<ExerciseRecord>("exercises", {
      select: "id,focus_area,name,equipment,default_metric,suggested_sets,suggested_reps,notes,activity_type_id,activity_types(name)",
      is_active: "eq.true",
      order: "source_row.asc,name.asc",
      limit: 1000,
    }),
  ]);

  const workoutTypes = activityTypes
    .map((type) => type.name)
    .filter((name, index, all) => name && all.indexOf(name) === index);

  return {
    exercises: exercises.map((row) => ({
      id: row.id,
      workoutType: row.activity_types?.name ?? "",
      focusArea: row.focus_area ?? "",
      name: row.name,
      equipment: row.equipment ?? "",
      metric: row.default_metric ?? "",
      suggestedSets: row.suggested_sets ?? "",
      suggestedReps: row.suggested_reps ?? "",
      notes: row.notes ?? "",
    })),
    workoutTypes,
    focusAreas: Array.from(new Set(exercises.map((row) => row.focus_area ?? "").filter(Boolean))),
    ...FALLBACK_SETTINGS,
  };
}

function firstSet(entry: SessionEntryRecord) {
  return entry.entry_sets?.[0];
}

function metricValue(metrics: EntryMetricRecord[] | null | undefined, key: string) {
  const row = metrics?.find((metric) => metric.metric_key === key);
  return asText(row?.metric_text ?? row?.metric_value);
}

export async function getRecentLogsClient() {
  await requirePerson();
  const rows = await supabasePublicSelect<SessionEntryRecord>("session_entries", {
    select:
      "id,entry_kind,name,progression_level,completed,notes,source_sheet,exercises(name,focus_area,activity_types(name)),activity_types(name),entry_sets(set_number,reps,weight,duration_seconds,rpe,rest_time,assistance_type,assistance_detail,quality),sessions!inner(session_date,title,completed,duration_minutes,intensity,rpe,notes,source_sheet,activity_types(name))",
    "sessions.source_sheet": "eq.Workout Log",
    order: "created_at.desc",
    limit: 15,
  });

  return {
    recent: rows.map((row) => {
      const set = firstSet(row);
      return {
        date: row.sessions?.session_date ?? "",
        workoutType:
          row.activity_types?.name ??
          row.exercises?.activity_types?.name ??
          row.sessions?.activity_types?.name ??
          "",
        focusArea: row.exercises?.focus_area ?? "",
        exercise: row.name,
        sets: asText(set?.set_number),
        reps: asText(set?.reps),
        weight: asText(set?.weight),
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
      };
    }),
  };
}

export async function addWorkoutClient(data: WorkoutLogInput) {
  const person = await requirePerson();
  const [activityType, exercise] = await Promise.all([
    getOrCreateActivityType(data.workoutType || "Other"),
    findExercise(data.exercise),
  ]);
  const durationMinutes = toNum(data.duration);
  const rpe = toNum(data.rpe);
  const insertedSession = await supabasePublicInsert<{ id: string; source_row: number | null }>("sessions", {
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
  });
  const session = insertedSession[0];
  if (!session) throw new Error("Workout was not saved.");

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
  await supabasePublicInsert("entry_sets", {
    session_entry_id: entry.id,
    set_number: toNum(data.sets),
    reps: toNum(data.reps),
    weight: toNum(data.weight),
    duration_seconds: holdSeconds,
    rpe,
    rest_time: data.restTime || null,
    assistance_type: data.assistanceType || null,
    assistance_detail: data.assistanceDetail || null,
    quality: data.quality || null,
    completed: data.completed,
    notes: data.notes || null,
  });

  return { ok: true, row: session.source_row ?? "Supabase" };
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
        date: row.session_date,
        type: row.activity_types?.name ?? row.title ?? "",
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
  const hours = toNum(data.hours);
  const rpe = toNum(data.rpe);
  const insertedSession = await supabasePublicInsert<{ id: string; source_row: number | null }>("sessions", {
    person_id: person.id,
    activity_type_id: activityType?.id ?? null,
    session_date: data.date,
    title: data.type || "Climbing",
    source: "manual",
    completed: data.completed,
    duration_minutes: hours == null ? null : hours * 60,
    intensity: data.intensity || null,
    rpe,
    notes: data.notes || null,
    source_sheet: "Climbing Log",
  });
  const session = insertedSession[0];
  if (!session) throw new Error("Climb was not saved.");

  const insertedEntry = await supabasePublicInsert<{ id: string }>("session_entries", {
    session_id: session.id,
    activity_type_id: activityType?.id ?? null,
    entry_kind: "Climbing",
    name: data.type || "Climbing",
    order_index: 0,
    completed: data.completed,
    notes: data.notes || null,
    source_sheet: "Climbing Log",
  });
  const entry = insertedEntry[0];
  if (!entry) throw new Error("Climb entry was not saved.");

  await supabasePublicInsert("entry_metrics", [
    { session_entry_id: entry.id, metric_key: "tracking_mode", metric_text: data.trackingMode || null },
    { session_entry_id: entry.id, metric_key: "hours", metric_value: hours, metric_unit: "h" },
    { session_entry_id: entry.id, metric_key: "boulders", metric_value: toNum(data.boulders) },
    { session_entry_id: entry.id, metric_key: "grade", metric_text: data.grade || null },
    { session_entry_id: entry.id, metric_key: "gradient", metric_text: data.gradient || null },
  ]);

  return { ok: true, row: session.source_row ?? "Supabase" };
}

function estimateOneRM(weight: number | null, reps: number | null, formula: string) {
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
        "test_date,source,exercise_name,load_type,external_weight,reps,rpe,estimated_total,estimated_external,is_pr",
      order: "test_date.desc,created_at.desc",
      limit: 15,
    }),
    supabasePublicSelect<BodyweightRecord>("bodyweight_logs", {
      select: "logged_date,bodyweight,notes",
      order: "logged_date.desc,created_at.desc",
      limit: 10,
    }),
  ]);

  return {
    recent: tests.map((row) => ({
      date: row.test_date,
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
      bodyweight: asText(row.bodyweight),
      notes: row.notes ?? "",
    })),
    latestBodyweight: asText(bodyweight[0]?.bodyweight),
  };
}

export async function add1RMTestClient(data: OneRMInput) {
  const person = await requirePerson();
  const externalWeight = toNum(data.externalWeight);
  const reps = toNum(data.reps);
  const estimatedExternal = estimateOneRM(externalWeight, reps, data.formula);
  const estimatedTotal = estimatedExternal;

  const prior = await supabasePublicSelect<Pick<OneRMRecord, "estimated_total" | "estimated_external" | "external_weight">>(
    "one_rm_tests",
    {
      select: "estimated_total,estimated_external,external_weight",
      exercise_name: `eq.${data.exercise}`,
      order: "estimated_total.desc",
      limit: 1,
    },
  );
  const priorBest = toNum(prior[0]?.estimated_total ?? prior[0]?.estimated_external ?? prior[0]?.external_weight);
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
    formula: data.formula || null,
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
        "test_date,source,exercise_name,load_type,external_weight,reps,rpe,estimated_total,estimated_external,is_pr",
      is_pr: "eq.true",
      order: "exercise_name.asc,test_date.desc",
      limit: 200,
    }),
    supabasePublicSelect<SessionEntryRecord>("session_entries", {
      select:
        "id,entry_kind,name,progression_level,completed,notes,entry_sets(reps,duration_seconds,assistance_type,assistance_detail),sessions!inner(session_date,completed,source_sheet,activity_types(name))",
      completed: "eq.true",
      "sessions.completed": "eq.true",
      limit: 1000,
    }),
  ]);

  const oneRmByExercise = new Map<string, OneRMRecord>();
  for (const row of tests) {
    const current = oneRmByExercise.get(row.exercise_name);
    const currentValue = toNum(current?.estimated_total ?? current?.estimated_external ?? current?.external_weight);
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
  for (const row of skills) {
    const workoutType = row.activity_types?.name ?? row.sessions?.activity_types?.name ?? "";
    if (row.entry_kind !== "Skill" && workoutType !== SKILL_WORKOUT_TYPE) continue;
    const set = firstSet(row);
    const assistanceType = (set?.assistance_type ?? "").trim();
    const assistanceDetail = (set?.assistance_detail ?? "").trim();
    const assisted = Boolean(assistanceType && assistanceType.toLowerCase() !== "none") || Boolean(assistanceDetail);
    const assistanceLabel = [assisted ? assistanceType : "", assistanceDetail].filter(Boolean).join(" · ");
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
      const key = `${base.skill}::${base.progression}::${metric}::${base.assistance}`;
      const current = skillBest.get(key);
      const currentValue = current?.value ?? null;
      if (currentValue != null && value < currentValue) return;
      if (currentValue === value && assistanceAmount != null && current?.assistanceAmount != null && assistanceAmount >= current.assistanceAmount) {
        return;
      }
      skillBest.set(key, { ...base, metric, value, unit });
    };
    const hold = toNum(set?.duration_seconds);
    const reps = toNum(set?.reps);
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
