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

type ActivityTypeRef = { name: string | null } | null;

type EntrySetRecord = {
  set_number: number | string | null;
  reps: number | string | null;
  weight: number | string | null;
  duration_seconds: number | string | null;
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
  activity_types: ActivityTypeRef;
  entry_sets: EntrySetRecord[] | null;
  entry_metrics: EntryMetricRecord[] | null;
};

type SessionRecord = {
  id: string;
  session_date: string;
  title: string | null;
  completed: boolean;
  duration_minutes: number | string | null;
  source_sheet: string | null;
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

function repsPerSet(totalReps: number, sets: number) {
  if (!Number.isFinite(totalReps) || totalReps <= 0) return null;
  if (!Number.isFinite(sets) || sets <= 0) return Math.ceil(totalReps);
  return Math.ceil(totalReps / sets);
}

function entryMinutes(entry: SessionEntryRecord, session: SessionRecord) {
  const sessionMinutes = toNum(session.duration_minutes);
  if (Number.isFinite(sessionMinutes) && sessionMinutes > 0) return sessionMinutes;
  const setMinutes = (entry.entry_sets ?? []).reduce((total, set) => {
    const seconds = toNum(set.duration_seconds);
    return total + (Number.isFinite(seconds) && seconds > 0 ? seconds / 60 : 0);
  }, 0);
  return setMinutes;
}

function isClimbing(session: SessionRecord, entry?: SessionEntryRecord) {
  const labels = [
    session.source_sheet,
    session.activity_types?.name,
    session.title,
    entry?.entry_kind,
    entry?.activity_types?.name,
    entry?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return labels.includes("climb") || labels.includes("boulder");
}

function isWorkoutLog(session: SessionRecord) {
  return session.source_sheet === "Workout Log";
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
        "id,session_date,title,completed,duration_minutes,source_sheet,activity_types(name),session_entries(id,entry_kind,name,progression_level,completed,notes,source_sheet,activity_types(name),entry_sets(set_number,reps,weight,duration_seconds,assistance_type,assistance_detail,quality),entry_metrics(metric_key,metric_value,metric_text,metric_unit))",
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
      order: "source_row.asc",
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
    const climbing = isClimbing(session, entries[0]);

    if (climbing) {
      const primary = entries[0];
      const metrics = primary?.entry_metrics ?? [];
      const hours =
        metricNumber(metrics, "hours") ??
        (Number.isFinite(toNum(session.duration_minutes))
          ? toNum(session.duration_minutes) / 60
          : 0);
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
        bouldersThisMonth += metricNumber(metrics, "boulders") ?? 0;
      }

      if (weekStart.getTime() === thisWeekStart.getTime()) {
        activeDaysThisWeek.add(dateISO);
        const day = weekDayByISO.get(dateISO);
        if (day) {
          const name = session.title ?? primary?.name ?? "Climbing";
          if (!day.exercises.includes(name)) day.exercises.push(name);
          const minutes = hoursSafe * 60;
          day.minutes += minutes;
          day.entries.push({
            kind: "climb",
            exercise: name,
            sets: null,
            reps: metricNumber(metrics, "boulders"),
            weight: null,
            minutes: minutes || null,
            completed: true,
            counts: false,
            notes: metricText(metrics, "grade")
              ? `Grade ${metricText(metrics, "grade")}`
              : "",
          });
        }
      }

      if (!latestClimb || dateISO > latestClimb.date) {
        latestClimb = {
          date: dateISO,
          grade: metricText(metrics, "grade"),
          name: session.title ?? primary?.name ?? "Climbing",
        };
      }
      continue;
    }

    for (const entry of entries) {
      const counts = isWorkoutLog(session);
      const minutes = entryMinutes(entry, session);
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
        if (week) {
          week.minutes += minutesSafe;
        }

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
            if (!day.exercises.includes(entry.name)) day.exercises.push(entry.name);
            const firstSet = entry.entry_sets?.[0];
            day.entries.push({
              kind: "workout",
              exercise: entry.name,
              sets: entry.entry_sets?.length || null,
              reps: Number.isFinite(toNum(firstSet?.reps)) ? toNum(firstSet?.reps) : null,
              weight: Number.isFinite(toNum(firstSet?.weight)) ? toNum(firstSet?.weight) : null,
              minutes: minutesSafe || null,
              completed: true,
              counts,
              notes: entry.notes ?? "",
            });
          }
        }

        const monthRow = monthRows.get(monthISO);
        const monthCountKey = `${monthISO}:${dateISO}`;
        if (monthRow && !countedMonthWorkoutDates.has(monthCountKey)) {
          countedMonthWorkoutDates.add(monthCountKey);
          monthRow.workouts += 1;
        }
        if (monthRow) {
          monthRow.minutes += minutesSafe;
        }
      }

      const entryKind = (entry.entry_kind ?? "").trim();
      const workoutType = entry.activity_types?.name ?? session.activity_types?.name ?? "";
      if (entryKind === "Skill" || entryKind === "Legacy Skill" || workoutType === SKILL_WORKOUT_TYPE) {
        const firstSet = entry.entry_sets?.[0];
        const holdSeconds = toNum(firstSet?.duration_seconds);
        const reps = repsPerSet(toNum(firstSet?.reps), toNum(firstSet?.set_number));
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
          if (!isBetterSkillPR({ value: valueNumber, assistanceAmount: base.assistanceAmount }, current)) {
            return;
          }
          skillPRs.set(key, {
            kind: "skill",
            title: base.title,
            value,
            detail: [
              base.progression,
              metric === "hold" ? "Best hold" : "Best reps",
              base.assisted ? `Assisted${base.assistanceLabel ? `: ${base.assistanceLabel}` : ""}` : "",
            ]
              .filter(Boolean)
              .join(" · "),
            date: base.date,
            valueNumber,
            assistanceAmount: base.assistanceAmount,
          });
        };
        if (Number.isFinite(holdSeconds) && holdSeconds > 0) {
          consider("hold", holdSeconds, `${holdSeconds}s`);
        }
        if (Number.isFinite(reps) && reps > 0) {
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
      avgWorkoutsPerWeek: weeksTraining
        ? Math.round((totalWorkouts / weeksTraining) * 10) / 10
        : 0,
      bodyweightDelta,
      startingBodyweight,
    },
    goals,
  };
}
