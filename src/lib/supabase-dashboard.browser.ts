import { supabasePublicSelect } from "./supabase-public";
import { claimNoamProfile, getCurrentPerson } from "./supabase-people.browser";
import type {
  BodyweightPoint,
  MonthRow,
  MonthStat,
  PRItem,
  WeekDay,
  WeekStat,
} from "./training-types";
import { getMovementMetricProfile, type MetricProfile } from "./movement-metrics";
import {
  comparableVolume,
  type DataShape,
  type LoadSemantics,
  type VolumeStatus,
} from "./data-quality";

type ActivityTypeRef = { name: string | null } | null;

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
  data_shape: DataShape | null;
  load_semantics: LoadSemantics | null;
  implement_count: number | string | null;
  volume_status: VolumeStatus | null;
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
  activity_types: ActivityTypeRef;
  exercises: { default_metric: string | null; activity_types: ActivityTypeRef } | null;
  entry_sets: EntrySetRecord[] | null;
  entry_metrics: EntryMetricRecord[] | null;
};

type SessionRecord = {
  id: string;
  session_date: string;
  title: string | null;
  completed: boolean;
  duration_minutes: number | string | null;
  intensity: string | null;
  rpe: number | string | null;
  activity_types: ActivityTypeRef;
  session_entries: SessionEntryRecord[] | null;
};

type OneRMRecord = {
  test_date: string;
  exercise_name: string;
  source: string | null;
  external_weight: number | string | null;
  reps: number | string | null;
  estimated_total: number | string | null;
  estimated_external: number | string | null;
  is_pr: boolean;
};

type BodyweightRecord = {
  logged_date: string;
  bodyweight: number | string;
};

type GoalRecord = {
  goal: string;
  metric: string | null;
  target: string | null;
  period: string | null;
};

export type DashboardData = {
  kpis: {
    workoutsThisWeek: number;
    minutesThisWeek: number;
    activeDaysThisWeek: number;
    climbingHoursThisMonth: number;
    climbingSessionsThisMonth: number;
    latestBodyweight: number | null;
    totalPRs: number;
  };
  thisWeekStart: string;
  weekDays: WeekDay[];
  workoutsByWeek: WeekStat[];
  climbingByMonth: MonthStat[];
  monthlySummary: MonthRow[];
  bodyweight: BodyweightPoint[];
  recentPRs: PRItem[];
  climbing: {
    sessionsThisMonth: number;
    hoursThisMonth: number;
    bouldersThisMonth: number;
    latestClimb: { date: string; grade: string; name: string } | null;
  };
  strength: {
    bestLift: { name: string; value: number; date: string } | null;
    latestTest: { name: string; value: number; date: string } | null;
    exercisesTracked: number;
  };
  trend: {
    firstWorkoutDate: string | null;
    weeksTraining: number;
    totalWorkouts: number;
    totalMinutes: number;
    totalClimbHours: number;
    totalClimbSessions: number;
    avgWorkoutsPerWeek: number;
    bodyweightDelta: number | null;
    startingBodyweight: number | null;
  };
  goals: {
    weeklyWorkouts: number | null;
    weeklyMinutes: number | null;
  };
};

const SKILL_WORKOUT_TYPE = "Skills/Calisthenics";

const toNum = (value: unknown): number => {
  if (value == null) return NaN;
  const text = value.toString().trim();
  if (!text) return NaN;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
};

function toISODateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeekUTC(date: Date): Date {
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function metricNumber(metrics: EntryMetricRecord[] | null | undefined, key: string) {
  const row = metrics?.find((m) => m.metric_key === key);
  const value = toNum(row?.metric_value ?? row?.metric_text);
  return Number.isFinite(value) ? value : null;
}

function metricText(metrics: EntryMetricRecord[] | null | undefined, key: string) {
  const row = metrics?.find((m) => m.metric_key === key);
  return (row?.metric_text ?? row?.metric_value ?? "").toString().trim();
}

function rounded(value: number, places = 1) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function displayNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(rounded(value));
}

function entryWorkoutType(entry: SessionEntryRecord, session: SessionRecord) {
  return (
    entry.activity_types?.name ??
    entry.exercises?.activity_types?.name ??
    session.activity_types?.name ??
    "Workout"
  );
}

function entryProfile(entry: SessionEntryRecord, session: SessionRecord) {
  const metrics = entry.entry_metrics ?? [];
  if (isClimbing(session, entry)) return "climbing";
  if (metricNumber(metrics, "height") != null) return "power";
  if (metricNumber(metrics, "rounds") != null) return "conditioning";
  return getMovementMetricProfile({
    workoutType: entryWorkoutType(entry, session),
    movement: entry.name,
    defaultMetric: entry.exercises?.default_metric ?? "",
  });
}

function entryDurationMinutes(entry: SessionEntryRecord) {
  const metrics = entry.entry_metrics ?? [];
  const minutes = metricNumber(metrics, "duration_minutes");
  if (minutes != null && minutes > 0) return minutes;
  const legacyHours = metricNumber(metrics, "hours");
  if (legacyHours != null && legacyHours > 0) return legacyHours * 60;
  return null;
}

function workoutMinutes(session: SessionRecord, entries: SessionEntryRecord[]) {
  const recordedSessionMinutes = toNum(session.duration_minutes);
  if (Number.isFinite(recordedSessionMinutes) && recordedSessionMinutes > 0) {
    return recordedSessionMinutes;
  }
  const entryMinutes = entries.reduce((total, entry) => {
    const duration = entryDurationMinutes(entry);
    return total + (duration != null ? duration : 0);
  }, 0);
  if (entryMinutes > 0) return entryMinutes;
  return entries.reduce((total, entry) => {
    const seconds = (entry.entry_sets ?? []).reduce((setTotal, set) => {
      const duration = toNum(set.duration_seconds);
      return setTotal + (Number.isFinite(duration) && duration > 0 ? duration : 0);
    }, 0);
    return total + seconds / 60;
  }, 0);
}

function entryDetails(entry: SessionEntryRecord, session: SessionRecord, profile: MetricProfile) {
  const sets = entry.entry_sets ?? [];
  const metrics = entry.entry_metrics ?? [];
  const details: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) details.push({ label, value });
  };
  const setCount = sets.length > 1 ? sets.length : toNum(sets[0]?.set_number);
  const totalReps = sets.reduce((total, set) => {
    const reps = toNum(set.reps);
    return total + (Number.isFinite(reps) && reps > 0 ? reps : 0);
  }, 0);
  const maxWeight = sets.reduce<number | null>((max, set) => {
    const weight = toNum(set.weight);
    return !Number.isFinite(weight) || (max != null && max >= weight) ? max : weight;
  }, null);
  const bestRpe = sets.reduce<number | null>((max, set) => {
    const rpe = toNum(set.rpe);
    return !Number.isFinite(rpe) || (max != null && max >= rpe) ? max : rpe;
  }, null);
  const totalHoldSeconds = sets.reduce((total, set) => {
    const seconds = toNum(set.duration_seconds);
    return total + (Number.isFinite(seconds) && seconds > 0 ? seconds : 0);
  }, 0);
  const bestHoldSeconds = sets.reduce((max, set) => {
    const seconds = toNum(set.duration_seconds);
    return Number.isFinite(seconds) && seconds > max ? seconds : max;
  }, 0);
  const distanceSet = sets.find((set) => Number.isFinite(toNum(set.distance)));
  const distance = distanceSet ? toNum(distanceSet.distance) : NaN;
  const distanceValue = Number.isFinite(distance)
    ? `${displayNumber(distance)} ${distanceSet?.distance_unit ?? ""}`.trim()
    : null;
  const duration =
    entryDurationMinutes(entry) ??
    ((profile === "climbing" || sets.length === 1) &&
    Number.isFinite(toNum(session.duration_minutes))
      ? toNum(session.duration_minutes)
      : null);
  const rpe =
    metricNumber(metrics, "rpe") ??
    bestRpe ??
    (Number.isFinite(toNum(session.rpe)) ? toNum(session.rpe) : null);
  const assistance = [sets[0]?.assistance_type, sets[0]?.assistance_detail]
    .filter((value) => value && value.toLowerCase() !== "none")
    .join(" · ");

  if (profile === "climbing") {
    add("Duration", duration != null ? `${displayNumber(duration)} min` : null);
    add(
      "Problems / routes",
      metricNumber(metrics, "boulders") != null
        ? displayNumber(metricNumber(metrics, "boulders") ?? 0)
        : null,
    );
    add("Max grade", metricText(metrics, "grade"));
    add("Gradient", metricText(metrics, "gradient"));
    const mode = metricText(metrics, "tracking_mode");
    add(
      "Tracking",
      ["Hours", "Time only"].includes(mode)
        ? "Time only"
        : ["Boulders", "Boulders/Routes"].includes(mode)
          ? "Problems / routes"
          : mode,
    );
  } else if (profile === "hold" || profile === "grip") {
    add("Attempts", setCount > 0 ? displayNumber(setCount) : null);
    add("Total hold", totalHoldSeconds > 0 ? `${displayNumber(totalHoldSeconds)} sec` : null);
    add("Best hold", bestHoldSeconds > 0 ? `${displayNumber(bestHoldSeconds)} sec` : null);
    if (profile === "grip" && maxWeight != null) {
      add("Load", maxWeight > 0 ? `${displayNumber(maxWeight)} kg` : "Bodyweight");
    }
    add(profile === "grip" ? "Grip style" : "Progression", entry.progression_level);
    add(profile === "grip" ? "Load detail" : "Assistance", assistance);
  } else if (profile === "mobility_position") {
    add("Distance", distanceValue);
    add("Hold", totalHoldSeconds > 0 ? `${displayNumber(totalHoldSeconds)} sec` : null);
    const feel = metricNumber(metrics, "feel");
    add("Feel", feel != null ? `${displayNumber(feel)} / 5` : null);
  } else if (profile === "time") {
    add("Distance", distanceValue);
    add("Duration", duration != null ? `${displayNumber(duration)} min` : null);
  } else if (profile === "duration") {
    add("Duration", duration != null ? `${displayNumber(duration)} min` : null);
  } else if (profile === "conditioning" || profile === "carry") {
    add("Duration", duration != null ? `${displayNumber(duration)} min` : null);
    const rounds = metricNumber(metrics, "rounds") ?? (setCount > 0 ? setCount : null);
    add("Rounds", rounds != null ? displayNumber(rounds) : null);
    if (profile === "carry") add("Distance", distanceValue);
    add("Load", maxWeight != null ? `${displayNumber(maxWeight)} kg` : null);
    add("Detail", metricText(metrics, "detail"));
  } else if (profile === "power") {
    add("Sets", setCount > 0 ? displayNumber(setCount) : null);
    add("Jumps", totalReps > 0 ? displayNumber(totalReps) : null);
    const height = metricNumber(metrics, "height");
    add("Best height", height != null ? `${displayNumber(height)} cm` : null);
    add("Quality", sets.find((set) => set.quality)?.quality);
  } else {
    add("Sets", setCount > 0 ? displayNumber(setCount) : null);
    add("Total reps", totalReps > 0 ? displayNumber(totalReps) : null);
    if (profile === "weighted") {
      add("Top load", maxWeight != null ? `${displayNumber(maxWeight)} kg` : null);
      const volume = sets.reduce((total, set) => {
        const reps = toNum(set.reps);
        const weight = toNum(set.weight);
        return (
          total +
          (comparableVolume({
            reps: Number.isFinite(reps) ? reps : null,
            weight: Number.isFinite(weight) ? weight : null,
            volumeStatus: set.volume_status ?? "unknown",
            loadSemantics: set.load_semantics ?? "unknown",
            implementCount: set.implement_count == null ? null : Number(set.implement_count),
          }) ?? 0)
        );
      }, 0);
      add("Volume", volume > 0 ? `${displayNumber(volume)} kg` : null);
    } else {
      add("Progression", entry.progression_level);
      add("Assistance", assistance);
    }
  }

  const positionMeasurement = metricNumber(metrics, "position_measurement");
  const positionSetup = metricText(metrics, "position_measurement_setup");
  add(
    "Position",
    positionMeasurement != null
      ? `${displayNumber(positionMeasurement)} cm${positionSetup ? ` · ${positionSetup}` : ""}`
      : null,
  );
  if (profile !== "mobility_position") add("RPE", rpe != null ? displayNumber(rpe) : null);
  add("Intensity", session.intensity);
  return details;
}

function isClimbing(session: SessionRecord, entry?: SessionEntryRecord) {
  const entryLabels = [
    entry?.entry_kind,
    entry?.activity_types?.name,
    entry?.exercises?.activity_types?.name,
    entry?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (entryLabels) return entryLabels.includes("climb") || entryLabels.includes("boulder");
  const sessionLabels = [session.activity_types?.name, session.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return sessionLabels.includes("climb") || sessionLabels.includes("boulder");
}

function countsAsWorkout(entries: SessionEntryRecord[]) {
  return entries.length > 0;
}

function assistanceInfo(set: EntrySetRecord | undefined) {
  const rawType = (set?.assistance_type ?? "").toString().trim();
  const rawDetail = (set?.assistance_detail ?? "").toString().trim();
  const isNone = !rawType || rawType.toLowerCase() === "none";
  const label = [isNone ? "" : rawType, rawDetail].filter(Boolean).join(" · ");
  const amount = toNum(rawDetail || rawType);
  return {
    assisted: !isNone || Boolean(rawDetail),
    amount: Number.isFinite(amount) ? amount : null,
    label,
  };
}

function isBetterSkillPR(
  next: { value: number; assistanceAmount: number | null },
  current: { value: string; assistanceAmount?: number | null } | undefined,
) {
  if (!current) return true;
  const currentValue = toNum(current.value);
  if (next.value !== currentValue) return next.value > currentValue;
  if (next.assistanceAmount != null && current.assistanceAmount != null) {
    return next.assistanceAmount < current.assistanceAmount;
  }
  return false;
}

function parseWeeklyGoals(goals: GoalRecord[]) {
  let weeklyWorkouts: number | null = null;
  let weeklyMinutes: number | null = null;

  for (const row of goals) {
    const goal = row.goal.toLowerCase();
    const metric = (row.metric ?? "").toLowerCase();
    const target = row.target ?? "";
    const period = (row.period ?? "").toLowerCase();
    const isWeekly = period.includes("week") || metric.includes("week") || goal.includes("week");
    if (!isWeekly) continue;

    const value = Number(target.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(value) || value <= 0) continue;

    const blob = `${goal} ${metric} ${target.toLowerCase()}`;
    if (weeklyMinutes == null && (blob.includes("minute") || /\bmin\b/.test(blob))) {
      weeklyMinutes = Math.round(value);
      continue;
    }
    if (
      weeklyWorkouts == null &&
      (blob.includes("workout") || blob.includes("session") || blob.includes("train"))
    ) {
      weeklyWorkouts = Math.round(value);
    }
  }

  return { weeklyWorkouts, weeklyMinutes };
}

export async function getDashboardDataClient(): Promise<DashboardData> {
  const person = (await getCurrentPerson()) ?? (await claimNoamProfile());
  if (!person) throw new Error("Link this login to your profile first.");

  const [sessions, oneRM, bodyweightRows, goalRows] = await Promise.all([
    supabasePublicSelect<SessionRecord>("sessions", {
      select:
        "id,session_date,title,completed,duration_minutes,intensity,rpe,activity_types(name),session_entries(id,entry_kind,name,progression_level,completed,notes,activity_types(name),exercises(default_metric,activity_types(name)),entry_sets(set_number,reps,weight,duration_seconds,distance,distance_unit,rpe,rest_time,assistance_type,assistance_detail,quality,data_shape,load_semantics,volume_status,implement_count),entry_metrics(metric_key,metric_value,metric_text,metric_unit))",
      order: "session_date.asc",
      limit: 1000,
    }),
    supabasePublicSelect<OneRMRecord>("one_rm_tests", {
      select:
        "test_date,exercise_name,source,external_weight,reps,estimated_total,estimated_external,is_pr",
      order: "test_date.asc",
      limit: 1000,
    }),
    supabasePublicSelect<BodyweightRecord>("bodyweight_logs", {
      select: "logged_date,bodyweight",
      order: "logged_date.asc",
      limit: 1000,
    }),
    supabasePublicSelect<GoalRecord>("goals", {
      select: "goal,metric,target,period",
      status: "eq.active",
      order: "created_at.asc",
      limit: 200,
    }),
  ]);

  const now = new Date();
  const thisWeekStart = startOfWeekUTC(now);
  const thisMonthStart = startOfMonthUTC(now);
  const todayISO = toISODateString(now);

  const weekDays: WeekDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
    (label, index) => {
      const d = new Date(thisWeekStart);
      d.setUTCDate(d.getUTCDate() + index);
      const iso = toISODateString(d);
      return {
        date: iso,
        label,
        workouts: 0,
        minutes: 0,
        exercises: [],
        entries: [],
        isToday: iso === todayISO,
      };
    },
  );
  const weekDayByISO = new Map(weekDays.map((day) => [day.date, day]));

  const weekBuckets = new Map<string, WeekStat>();
  for (let i = 11; i >= 0; i--) {
    const ws = new Date(thisWeekStart);
    ws.setUTCDate(ws.getUTCDate() - i * 7);
    const iso = toISODateString(ws);
    weekBuckets.set(iso, {
      weekStart: iso,
      label: ws.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      }),
      workouts: 0,
      minutes: 0,
    });
  }

  const monthRows = new Map<string, MonthRow>();
  const monthBuckets = new Map<string, MonthStat>();
  for (let i = 5; i >= 0; i--) {
    const ms = new Date(thisMonthStart);
    ms.setUTCMonth(ms.getUTCMonth() - i);
    const iso = toISODateString(ms);
    monthRows.set(iso, {
      monthStart: iso,
      label: ms.toLocaleDateString("en-GB", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
      workouts: 0,
      minutes: 0,
      climbSessions: 0,
      climbHours: 0,
    });
    monthBuckets.set(iso, {
      monthStart: iso,
      label: ms.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      hours: 0,
    });
  }

  let workoutsThisWeek = 0;
  let minutesThisWeek = 0;
  const activeDaysThisWeek = new Set<string>();
  let totalWorkouts = 0;
  let totalMinutes = 0;
  let firstWorkoutDate: Date | null = null;
  let climbingHoursThisMonth = 0;
  let climbingSessionsThisMonth = 0;
  let bouldersThisMonth = 0;
  let totalClimbHours = 0;
  let totalClimbSessions = 0;
  let latestClimb: { date: string; grade: string; name: string } | null = null;
  const countedWorkoutDates = new Set<string>();
  const countedThisWeekWorkoutDates = new Set<string>();
  const countedWeekWorkoutDates = new Set<string>();
  const countedMonthWorkoutDates = new Set<string>();

  const skillPRs = new Map<
    string,
    PRItem & { valueNumber: number; assistanceAmount?: number | null }
  >();

  for (const session of sessions) {
    if (!session.completed) continue;
    const date = parseISODate(session.session_date);
    const dateISO = session.session_date;
    const weekStart = startOfWeekUTC(date);
    const monthStart = startOfMonthUTC(date);
    const monthISO = toISODateString(monthStart);
    const entries = session.session_entries?.filter((entry) => entry.completed) ?? [];
    const climbing = entries.length > 0 && entries.every((entry) => isClimbing(session, entry));

    if (climbing) {
      const primary = entries[0];
      const recordedSessionMinutes = toNum(session.duration_minutes);
      const climbingMinutes =
        Number.isFinite(recordedSessionMinutes) && recordedSessionMinutes > 0
          ? recordedSessionMinutes
          : entries.reduce((total, entry) => total + (entryDurationMinutes(entry) ?? 0), 0);
      const hours = climbingMinutes / 60;
      const hoursSafe = Number.isFinite(hours) ? hours : 0;
      totalClimbHours += hoursSafe;
      totalClimbSessions += 1;

      const month = monthBuckets.get(monthISO);
      if (month) month.hours += hoursSafe;
      const monthRow = monthRows.get(monthISO);
      if (monthRow) {
        monthRow.climbHours += hoursSafe;
        monthRow.climbSessions += 1;
      }

      if (monthStart.getTime() === thisMonthStart.getTime()) {
        climbingHoursThisMonth += hoursSafe;
        climbingSessionsThisMonth += 1;
        bouldersThisMonth += entries.reduce(
          (total, entry) => total + (metricNumber(entry.entry_metrics, "boulders") ?? 0),
          0,
        );
      }

      if (weekStart.getTime() === thisWeekStart.getTime()) {
        activeDaysThisWeek.add(dateISO);
        const day = weekDayByISO.get(dateISO);
        if (day) {
          const minutes = hoursSafe * 60;
          day.minutes += minutes;
          for (const entry of entries) {
            if (!day.exercises.includes(entry.name)) day.exercises.push(entry.name);
            day.entries.push({
              exercise: entry.name,
              activityLabel: "Climbing",
              details: entryDetails(entry, session, entryProfile(entry, session)),
              completed: true,
              counts: false,
              notes: entry.notes ?? "",
            });
          }
        }
      }

      if (!latestClimb || dateISO > latestClimb.date) {
        latestClimb = {
          date: dateISO,
          grade:
            entries.map((entry) => metricText(entry.entry_metrics, "grade")).find(Boolean) ?? "",
          name: primary?.name ?? session.title ?? "Climbing",
        };
      }
      continue;
    }

    const counts = countsAsWorkout(entries);
    const minutes = workoutMinutes(session, entries);
    const minutesSafe = Number.isFinite(minutes) ? minutes : 0;
    if (counts) {
      if (!countedWorkoutDates.has(dateISO)) {
        countedWorkoutDates.add(dateISO);
        totalWorkouts += 1;
      }
      totalMinutes += minutesSafe;
      if (!firstWorkoutDate || date < firstWorkoutDate) firstWorkoutDate = date;

      const week = weekBuckets.get(toISODateString(weekStart));
      const weekCountKey = `${toISODateString(weekStart)}:${dateISO}`;
      if (week && !countedWeekWorkoutDates.has(weekCountKey)) {
        countedWeekWorkoutDates.add(weekCountKey);
        week.workouts += 1;
      }
      if (week) week.minutes += minutesSafe;

      if (weekStart.getTime() === thisWeekStart.getTime()) {
        if (!countedThisWeekWorkoutDates.has(dateISO)) {
          countedThisWeekWorkoutDates.add(dateISO);
          workoutsThisWeek += 1;
        }
        minutesThisWeek += minutesSafe;
        activeDaysThisWeek.add(dateISO);
        const day = weekDayByISO.get(dateISO);
        if (day) {
          day.workouts = 1;
          day.minutes += minutesSafe;
          for (const entry of entries) {
            if (!day.exercises.includes(entry.name)) day.exercises.push(entry.name);
            const profile = entryProfile(entry, session);
            day.entries.push({
              exercise: entry.name,
              activityLabel: entryWorkoutType(entry, session),
              details: entryDetails(entry, session, profile),
              completed: true,
              counts,
              notes: entry.notes ?? "",
            });
          }
        }
      }

      const monthRow = monthRows.get(monthISO);
      const monthCountKey = `${monthISO}:${dateISO}`;
      if (monthRow && !countedMonthWorkoutDates.has(monthCountKey)) {
        countedMonthWorkoutDates.add(monthCountKey);
        monthRow.workouts += 1;
      }
      if (monthRow) monthRow.minutes += minutesSafe;
    }

    for (const entry of entries) {
      const entryKind = (entry.entry_kind ?? "").trim();
      const workoutType = entryWorkoutType(entry, session);
      if (
        entryKind === "Skill" ||
        entryKind === "Legacy Skill" ||
        workoutType === SKILL_WORKOUT_TYPE
      ) {
        const setRows = entry.entry_sets ?? [];
        const firstSet = setRows[0];
        const individualSets = setRows.filter((set) => set.data_shape === "individual");
        const holdSeconds = setRows.reduce<number | null>((max, set) => {
          const value = toNum(set.duration_seconds);
          return value == null || (max != null && max >= value) ? max : value;
        }, null);
        const reps = individualSets.length
          ? individualSets.reduce<number | null>((max, set) => {
              const value = toNum(set.reps);
              return value == null || (max != null && max >= value) ? max : value;
            }, null)
          : null;
        const assistance = assistanceInfo(firstSet);
        const base = {
          title: entry.name,
          progression: entry.progression_level ?? "",
          date: dateISO,
          assisted: assistance.assisted,
          assistanceLabel: assistance.label,
          assistanceAmount: assistance.amount,
        };
        const consider = (metric: "hold" | "reps", valueNumber: number, value: string) => {
          const key = `${base.title}::${base.progression}::${metric}::${base.assisted ? "assisted" : "unassisted"}`;
          const current = skillPRs.get(key);
          if (
            !isBetterSkillPR(
              { value: valueNumber, assistanceAmount: base.assistanceAmount },
              current,
            )
          ) {
            return;
          }
          skillPRs.set(key, {
            kind: "skill",
            title: base.title,
            value,
            detail: [
              base.progression,
              metric === "hold" ? "Best hold" : "Best reps",
              base.assisted
                ? `Assisted${base.assistanceLabel ? `: ${base.assistanceLabel}` : ""}`
                : "",
            ]
              .filter(Boolean)
              .join(" · "),
            date: base.date,
            valueNumber,
            assistanceAmount: base.assistanceAmount,
          });
        };
        if (holdSeconds != null && Number.isFinite(holdSeconds) && holdSeconds > 0) {
          consider("hold", holdSeconds, `${holdSeconds}s`);
        }
        if (reps != null && Number.isFinite(reps) && reps > 0) {
          consider("reps", reps, `${reps} reps`);
        }
      }
    }
  }

  const bodyweight = bodyweightRows
    .map((row) => ({ date: row.logged_date, bodyweight: toNum(row.bodyweight) }))
    .filter((row) => Number.isFinite(row.bodyweight))
    .sort((a, b) => a.date.localeCompare(b.date));
  const latestBodyweight = bodyweight.length ? bodyweight[bodyweight.length - 1].bodyweight : null;
  const startingBodyweight = bodyweight.length ? bodyweight[0].bodyweight : null;
  const bodyweightDelta =
    latestBodyweight != null && startingBodyweight != null
      ? Math.round((latestBodyweight - startingBodyweight) * 10) / 10
      : null;

  const exerciseSet = new Set<string>();
  let bestLift: { name: string; value: number; date: string } | null = null;
  let latestTest: { name: string; value: number; date: string } | null = null;
  const prs: PRItem[] = [];

  for (const row of oneRM) {
    exerciseSet.add(row.exercise_name);
    const value = toNum(row.estimated_total ?? row.estimated_external ?? row.external_weight);
    const externalWeight = toNum(row.external_weight);
    const reps = toNum(row.reps);
    if (!Number.isFinite(value)) continue;
    if (!bestLift || value > bestLift.value) {
      bestLift = { name: row.exercise_name, value, date: row.test_date };
    }
    if (!latestTest || row.test_date > latestTest.date) {
      latestTest = { name: row.exercise_name, value, date: row.test_date };
    }
    if (row.is_pr) {
      prs.push({
        kind: "1rm",
        title: row.exercise_name,
        value: `${value}`,
        detail: [
          row.source,
          Number.isFinite(externalWeight) && Number.isFinite(reps)
            ? `${externalWeight} x ${reps}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        date: row.test_date,
      });
    }
  }

  prs.push(...Array.from(skillPRs.values()).map(({ valueNumber, assistanceAmount, ...pr }) => pr));
  prs.sort((a, b) => b.date.localeCompare(a.date));

  const weeksTraining = firstWorkoutDate
    ? Math.max(1, Math.round((now.getTime() - firstWorkoutDate.getTime()) / (7 * 86400000)))
    : 0;
  const goals = parseWeeklyGoals(goalRows);

  return {
    kpis: {
      workoutsThisWeek,
      minutesThisWeek,
      activeDaysThisWeek: activeDaysThisWeek.size,
      climbingHoursThisMonth: Math.round(climbingHoursThisMonth * 10) / 10,
      climbingSessionsThisMonth,
      latestBodyweight,
      totalPRs: prs.length,
    },
    thisWeekStart: toISODateString(thisWeekStart),
    weekDays,
    workoutsByWeek: Array.from(weekBuckets.values()),
    climbingByMonth: Array.from(monthBuckets.values()).map((row) => ({
      ...row,
      hours: Math.round(row.hours * 10) / 10,
    })),
    monthlySummary: Array.from(monthRows.values()).map((row) => ({
      ...row,
      minutes: Math.round(row.minutes),
      climbHours: Math.round(row.climbHours * 10) / 10,
    })),
    bodyweight,
    recentPRs: prs.slice(0, 8),
    climbing: {
      sessionsThisMonth: climbingSessionsThisMonth,
      hoursThisMonth: Math.round(climbingHoursThisMonth * 10) / 10,
      bouldersThisMonth,
      latestClimb,
    },
    strength: {
      bestLift,
      latestTest,
      exercisesTracked: exerciseSet.size,
    },
    trend: {
      firstWorkoutDate: firstWorkoutDate ? toISODateString(firstWorkoutDate) : null,
      weeksTraining,
      totalWorkouts,
      totalMinutes: Math.round(totalMinutes),
      totalClimbHours: Math.round(totalClimbHours * 10) / 10,
      totalClimbSessions,
      avgWorkoutsPerWeek: weeksTraining ? Math.round((totalWorkouts / weeksTraining) * 10) / 10 : 0,
      bodyweightDelta,
      startingBodyweight,
    },
    goals,
  };
}
