import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  batchUpdateValues,
  deleteSheetRow,
  getValues,
  SHEET_IDS,
} from "./sheets.server";
import { appSecretAuth } from "./auth-middleware";

// ===== Shared helpers =====

const shortText = (max = 200) => z.string().max(max).default("");
const longText = (max = 2000) => z.string().max(max).default("");

const toNum = (v: unknown): number => {
  if (v == null) return NaN;
  const t = v.toString().trim();
  if (!t) return NaN;
  const m = t.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

// Parse a date cell into a JS Date (UTC).
// Accepts ISO, DD/MM/YYYY, DD MMM YYYY, or a Sheets serial number.
const MONTH_NAMES = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];
function parseAnyDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const s = value.toString().trim();
  if (!s) return null;

  // Sheets serial number
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (Number.isFinite(serial) && serial > 0 && serial < 100000) {
      const ms = Date.UTC(1899, 11, 30) + serial * 86400000;
      return new Date(ms);
    }
  }

  // ISO
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let y = parseInt(dmy[3]);
    if (y < 100) y += 2000;
    return new Date(Date.UTC(y, parseInt(dmy[2]) - 1, parseInt(dmy[1])));
  }

  // DD MMM YYYY
  const text = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);
  if (text) {
    let y = parseInt(text[3]);
    if (y < 100) y += 2000;
    const m = MONTH_NAMES.indexOf(text[2].slice(0, 3).toLowerCase());
    if (m >= 0) return new Date(Date.UTC(y, m, parseInt(text[1])));
  }

  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function toISODateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeekUTC(date: Date): Date {
  // Monday-start weeks. getUTCDay: 0=Sun, 1=Mon...6=Sat
  const day = date.getUTCDay();
  const diff = (day + 6) % 7; // days since Monday
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

// ===== Exercise Library CRUD =====

export type LibraryRow = {
  row: number; // sheet row number (5-based for data)
  workoutType: string;
  focusArea: string;
  name: string;
  equipment: string;
  metric: string;
  suggestedSets: string;
  suggestedReps: string;
  notes: string;
};

const ExerciseInput = z.object({
  workoutType: shortText(100),
  focusArea: shortText(100),
  name: z.string().min(1).max(200),
  equipment: shortText(100),
  metric: shortText(60),
  suggestedSets: shortText(20),
  suggestedReps: shortText(40),
  notes: longText(1000),
});

export const listExercises = createServerFn({ method: "GET" })
  .middleware([appSecretAuth])
  .handler(async () => {
    const rows = await getValues("Exercise%20Library!A5:H400");
    const items: LibraryRow[] = [];
    rows.forEach((r, idx) => {
      const name = (r[2] ?? "").toString().trim();
      if (!name) return;
      items.push({
        row: 5 + idx,
        workoutType: r[0] ?? "",
        focusArea: r[1] ?? "",
        name,
        equipment: r[3] ?? "",
        metric: r[4] ?? "",
        suggestedSets: r[5] ?? "",
        suggestedReps: r[6] ?? "",
        notes: r[7] ?? "",
      });
    });
    return { items };
  });

async function findNextLibraryRow(): Promise<number> {
  const rows = await getValues("Exercise%20Library!C5:C400");
  let i = 0;
  while (i < rows.length && rows[i] && (rows[i][0] ?? "").toString().trim() !== "") {
    i++;
  }
  return 5 + i;
}

export const addExercise = createServerFn({ method: "POST" })
  .middleware([appSecretAuth])
  .inputValidator((d: unknown) => ExerciseInput.parse(d))
  .handler(async ({ data }) => {
    const row = await findNextLibraryRow();
    await batchUpdateValues([
      {
        range: `Exercise Library!A${row}:H${row}`,
        values: [[
          data.workoutType,
          data.focusArea,
          data.name,
          data.equipment,
          data.metric,
          data.suggestedSets,
          data.suggestedReps,
          data.notes,
        ]],
      },
    ]);
    return { ok: true, row };
  });

const UpdateExerciseInput = z.object({
  row: z.number().int().min(5).max(500),
  fields: ExerciseInput,
});

export const updateExercise = createServerFn({ method: "POST" })
  .middleware([appSecretAuth])
  .inputValidator((d: unknown) => UpdateExerciseInput.parse(d))
  .handler(async ({ data }) => {
    const { row, fields } = data;
    await batchUpdateValues([
      {
        range: `Exercise Library!A${row}:H${row}`,
        values: [[
          fields.workoutType,
          fields.focusArea,
          fields.name,
          fields.equipment,
          fields.metric,
          fields.suggestedSets,
          fields.suggestedReps,
          fields.notes,
        ]],
      },
    ]);
    return { ok: true };
  });

const DeleteExerciseInput = z.object({
  row: z.number().int().min(5).max(500),
});

export const deleteExercise = createServerFn({ method: "POST" })
  .middleware([appSecretAuth])
  .inputValidator((d: unknown) => DeleteExerciseInput.parse(d))
  .handler(async ({ data }) => {
    await deleteSheetRow(SHEET_IDS.exerciseLibrary, data.row);
    return { ok: true };
  });

// ===== Goals CRUD =====

export type GoalRow = {
  row: number; // 2-based
  goal: string;
  metric: string;
  target: string;
  period: string;
  notes: string;
};

const GoalInput = z.object({
  goal: z.string().min(1).max(150),
  metric: shortText(60),
  target: shortText(60),
  period: shortText(40),
  notes: longText(500),
});

export const listGoals = createServerFn({ method: "GET" })
  .middleware([appSecretAuth])
  .handler(async () => {
    const rows = await getValues("Goals!A2:E200");
    const items: GoalRow[] = [];
    rows.forEach((r, idx) => {
      const goal = (r[0] ?? "").toString().trim();
      if (!goal) return;
      items.push({
        row: 2 + idx,
        goal,
        metric: r[1] ?? "",
        target: r[2] ?? "",
        period: r[3] ?? "",
        notes: r[4] ?? "",
      });
    });
    return { items };
  });

async function findNextGoalRow(): Promise<number> {
  const rows = await getValues("Goals!A2:A200");
  let i = 0;
  while (i < rows.length && rows[i] && (rows[i][0] ?? "").toString().trim() !== "") {
    i++;
  }
  return 2 + i;
}

export const addGoal = createServerFn({ method: "POST" })
  .middleware([appSecretAuth])
  .inputValidator((d: unknown) => GoalInput.parse(d))
  .handler(async ({ data }) => {
    const row = await findNextGoalRow();
    await batchUpdateValues([
      {
        range: `Goals!A${row}:E${row}`,
        values: [[data.goal, data.metric, data.target, data.period, data.notes]],
      },
    ]);
    return { ok: true, row };
  });

const UpdateGoalInput = z.object({
  row: z.number().int().min(2).max(500),
  fields: GoalInput,
});

export const updateGoal = createServerFn({ method: "POST" })
  .middleware([appSecretAuth])
  .inputValidator((d: unknown) => UpdateGoalInput.parse(d))
  .handler(async ({ data }) => {
    const { row, fields } = data;
    await batchUpdateValues([
      {
        range: `Goals!A${row}:E${row}`,
        values: [[
          fields.goal,
          fields.metric,
          fields.target,
          fields.period,
          fields.notes,
        ]],
      },
    ]);
    return { ok: true };
  });

const DeleteGoalInput = z.object({
  row: z.number().int().min(2).max(500),
});

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([appSecretAuth])
  .inputValidator((d: unknown) => DeleteGoalInput.parse(d))
  .handler(async ({ data }) => {
    await deleteSheetRow(SHEET_IDS.goals, data.row);
    return { ok: true };
  });

// ===== Dashboard =====

export type WeekStat = {
  weekStart: string; // ISO date
  label: string; // "DD MMM"
  workouts: number;
  minutes: number;
};

export type MonthStat = {
  monthStart: string;
  label: string;
  hours: number;
};

export type BodyweightPoint = {
  date: string;
  bodyweight: number;
};

export type PRItem = {
  kind: "1rm" | "skill";
  title: string;
  value: string;
  detail: string;
  date: string;
};

export type WeekDay = {
  date: string;
  label: string;
  workouts: number;
  minutes: number;
  exercises: string[];
  isToday: boolean;
};

export type MonthRow = {
  monthStart: string;
  label: string;
  workouts: number;
  minutes: number;
  climbSessions: number;
  climbHours: number;
};

const isTrue = (v: unknown) => {
  const s = (v ?? "").toString().trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "✓" || s === "x";
};

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([appSecretAuth])
  .handler(async () => {
    const [workouts, climbs, oneRM, bw, skills] = await Promise.all([
      getValues("Workout%20Log!A5:M1000"),
      getValues("Climbing%20Log!A10:L1000"),
      getValues("1RM%20Tracker!A70:R400"),
      getValues("1RM%20Tracker!J7:L60"),
      getValues("Skills%20Tracker!A41:O500"),
    ]);

    const now = new Date();
    const thisWeekStart = startOfWeekUTC(now);
    const thisMonthStart = startOfMonthUTC(now);
    const todayISO = toISODateString(now);

    const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weekDays: WeekDay[] = weekDayLabels.map((label, i) => {
      const d = new Date(thisWeekStart);
      d.setUTCDate(d.getUTCDate() + i);
      const iso = toISODateString(d);
      return { date: iso, label, workouts: 0, minutes: 0, isToday: iso === todayISO };
    });
    const weekDayByISO = new Map(weekDays.map((w) => [w.date, w]));

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
    }

    let workoutsThisWeek = 0;
    let minutesThisWeek = 0;
    const activeDaysThisWeek = new Set<string>();
    let totalWorkouts = 0;
    let totalMinutes = 0;
    let firstWorkoutDate: Date | null = null;

    for (const r of workouts) {
      const exercise = (r[4] ?? "").toString().trim();
      if (!exercise) continue;
      const d = parseAnyDate(r[0]);
      if (!d) continue;
      const minutes = toNum(r[8]);
      const minutesSafe = Number.isFinite(minutes) ? minutes : 0;
      totalWorkouts += 1;
      totalMinutes += minutesSafe;
      if (!firstWorkoutDate || d < firstWorkoutDate) firstWorkoutDate = d;

      const ws = startOfWeekUTC(d);
      const wsISO = toISODateString(ws);
      const bucket = weekBuckets.get(wsISO);
      if (bucket) {
        bucket.workouts += 1;
        bucket.minutes += minutesSafe;
      }
      if (ws.getTime() === thisWeekStart.getTime()) {
        workoutsThisWeek += 1;
        minutesThisWeek += minutesSafe;
        const dayISO = toISODateString(d);
        const day = weekDayByISO.get(dayISO);
        if (day) {
          day.workouts += 1;
          day.minutes += minutesSafe;
          activeDaysThisWeek.add(dayISO);
        }
      }

      const ms = startOfMonthUTC(d);
      const mRow = monthRows.get(toISODateString(ms));
      if (mRow) {
        mRow.workouts += 1;
        mRow.minutes += minutesSafe;
      }
    }
    const workoutsByWeek = Array.from(weekBuckets.values());

    const monthBuckets = new Map<string, MonthStat>();
    for (let i = 5; i >= 0; i--) {
      const ms = new Date(thisMonthStart);
      ms.setUTCMonth(ms.getUTCMonth() - i);
      const iso = toISODateString(ms);
      monthBuckets.set(iso, {
        monthStart: iso,
        label: ms.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
        hours: 0,
      });
    }
    let climbingHoursThisMonth = 0;
    let climbingSessionsThisMonth = 0;
    let bouldersThisMonth = 0;
    let totalClimbHours = 0;
    let totalClimbSessions = 0;
    let latestClimb: { date: string; grade: string; name: string } | null = null;
    for (const r of climbs) {
      const d = parseAnyDate(r[0]);
      if (!d) continue;
      const hours = toNum(r[4]);
      const hoursSafe = Number.isFinite(hours) ? hours : 0;
      totalClimbHours += hoursSafe;
      totalClimbSessions += 1;
      const ms = startOfMonthUTC(d);
      const iso = toISODateString(ms);
      const bucket = monthBuckets.get(iso);
      if (bucket) bucket.hours += hoursSafe;
      const mRow = monthRows.get(iso);
      if (mRow) {
        mRow.climbSessions += 1;
        mRow.climbHours += hoursSafe;
      }
      if (ms.getTime() === thisMonthStart.getTime()) {
        climbingSessionsThisMonth += 1;
        climbingHoursThisMonth += hoursSafe;
        const boulders = toNum(r[5]);
        if (Number.isFinite(boulders)) bouldersThisMonth += boulders;
      }
      const dateISO = toISODateString(d);
      if (!latestClimb || dateISO > latestClimb.date) {
        latestClimb = {
          date: dateISO,
          grade: (r[2] ?? r[3] ?? "").toString().trim(),
          name: (r[1] ?? "").toString().trim(),
        };
      }
    }
    const climbingByMonth = Array.from(monthBuckets.values());
    const monthlySummary = Array.from(monthRows.values());

    const bodyweight: BodyweightPoint[] = [];
    for (const r of bw) {
      const d = parseAnyDate(r[0]);
      const v = toNum(r[1]);
      if (!d || !Number.isFinite(v)) continue;
      bodyweight.push({ date: toISODateString(d), bodyweight: v });
    }
    bodyweight.sort((a, b) => a.date.localeCompare(b.date));
    const latestBodyweight = bodyweight.length
      ? bodyweight[bodyweight.length - 1].bodyweight
      : null;
    const startingBodyweight = bodyweight.length ? bodyweight[0].bodyweight : null;
    const bodyweightDelta =
      latestBodyweight != null && startingBodyweight != null
        ? Math.round((latestBodyweight - startingBodyweight) * 10) / 10
        : null;

    const exerciseSet = new Set<string>();
    let bestLift: { name: string; value: number; date: string } | null = null;
    let latestTest: { name: string; value: number; date: string } | null = null;
    for (const r of oneRM) {
      const name = (r[3] ?? "").toString().trim();
      if (!name) continue;
      exerciseSet.add(name);
      const est = toNum(r[13] ?? r[14] ?? r[8]);
      const d = parseAnyDate(r[0]);
      if (!Number.isFinite(est) || !d) continue;
      const dateISO = toISODateString(d);
      if (!bestLift || est > bestLift.value) bestLift = { name, value: est, date: dateISO };
      if (!latestTest || dateISO > latestTest.date)
        latestTest = { name, value: est, date: dateISO };
    }

    const prs: PRItem[] = [];
    for (const r of oneRM) {
      if (!r[3] || !(r[15] ?? "").toString().includes("PR")) continue;
      const date = parseAnyDate(r[0]);
      const est = r[13] || r[14] || r[8];
      prs.push({
        kind: "1rm",
        title: r[3]?.toString() ?? "",
        value: est ? `${est}` : "",
        detail: [r[4], r[8] && r[9] ? `${r[8]} × ${r[9]}` : null]
          .filter(Boolean)
          .join(" · "),
        date: date ? toISODateString(date) : "",
      });
    }
    type SkillBest = { hold?: PRItem; reps?: PRItem };
    const skillMap = new Map<string, SkillBest>();
    for (const r of skills) {
      const skill = (r[1] ?? "").toString().trim();
      if (!skill) continue;
      const progression = (r[3] ?? "").toString().trim();
      const date = parseAnyDate(r[0]);
      const hold = toNum(r[7]);
      const reps = toNum(r[8]);
      const key = `${skill}::${progression}`;
      const entry = skillMap.get(key) ?? {};
      if (Number.isFinite(hold) && hold > 0) {
        const prev = entry.hold ? toNum(entry.hold.value) : -Infinity;
        if (hold > prev) {
          entry.hold = {
            kind: "skill",
            title: skill,
            value: `${hold}s`,
            detail: progression ? `${progression} · hold` : "Best hold",
            date: date ? toISODateString(date) : "",
          };
        }
      }
      if (Number.isFinite(reps) && reps > 0) {
        const prev = entry.reps ? toNum(entry.reps.value) : -Infinity;
        if (reps > prev) {
          entry.reps = {
            kind: "skill",
            title: skill,
            value: `${reps} reps`,
            detail: progression ? `${progression} · reps` : "Best reps",
            date: date ? toISODateString(date) : "",
          };
        }
      }
      skillMap.set(key, entry);
    }
    for (const v of skillMap.values()) {
      if (v.hold) prs.push(v.hold);
      if (v.reps) prs.push(v.reps);
    }
    prs.sort((a, b) => b.date.localeCompare(a.date));
    const recentPRs = prs.slice(0, 8);

    const weeksTraining = firstWorkoutDate
      ? Math.max(
          1,
          Math.round(
            (now.getTime() - (firstWorkoutDate as Date).getTime()) / (7 * 86400000),
          ),
        )
      : 0;
    const trend = {
      firstWorkoutDate: firstWorkoutDate ? toISODateString(firstWorkoutDate as Date) : null,
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
    };

    return {
      kpis: {
        workoutsThisWeek,
        minutesThisWeek,
        activeDaysThisWeek: activeDaysThisWeek.size,
        climbingHoursThisMonth,
        climbingSessionsThisMonth,
        latestBodyweight,
        totalPRs: prs.length,
      },
      thisWeekStart: toISODateString(thisWeekStart),
      weekDays,
      workoutsByWeek,
      climbingByMonth,
      monthlySummary,
      bodyweight,
      recentPRs,
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
      trend,
    };
  });

// ===== Library / settings dropdowns =====

export const getLibraryDropdowns = createServerFn({ method: "GET" })
  .middleware([appSecretAuth])
  .handler(async () => {
    const rows = await getValues("Settings!A14:F40");
    const workoutTypes: string[] = [];
    const focusAreas: string[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] ?? [];
      if (row[0]) workoutTypes.push(row[0]);
      if (row[1]) focusAreas.push(row[1]);
    }
    return { workoutTypes, focusAreas };
  });
