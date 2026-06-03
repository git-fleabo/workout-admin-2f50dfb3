import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  batchUpdateValues,
  findNextEmpty1RMRow,
  findNextEmptyBodyweightRow,
  findNextEmptyClimbRow,
  findNextEmptyLogRow,
  findNextEmptySkillRow,
  getValues,
} from "./sheets.server";
import { appSecretAuth } from "./auth-middleware";
import { toSheetsSerial } from "./date";

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


export const getLibrary = createServerFn({ method: "GET" }).middleware([appSecretAuth]).handler(async () => {
  const [libRaw, settingsRaw] = await Promise.all([
    getValues("Exercise%20Library!A5:H200"),
    getValues("Settings!A14:F40"),
  ]);

  const exercises = libRaw
    .filter((r) => r[2])
    .map((r) => ({
      workoutType: r[0] ?? "",
      focusArea: r[1] ?? "",
      name: r[2] ?? "",
      equipment: r[3] ?? "",
      metric: r[4] ?? "",
      suggestedSets: r[5] ?? "",
      suggestedReps: r[6] ?? "",
      notes: r[7] ?? "",
    }));

  const workoutTypes: string[] = [];
  const focusAreas: string[] = [];
  const intensities: string[] = [];
  const climbingTypes: string[] = [];
  const trackingModes: string[] = [];
  for (let i = 1; i < settingsRaw.length; i++) {
    const row = settingsRaw[i] ?? [];
    if (row[0]) workoutTypes.push(row[0]);
    if (row[1]) focusAreas.push(row[1]);
    if (row[2]) intensities.push(row[2]);
    if (row[4]) climbingTypes.push(row[4]);
    if (row[5]) trackingModes.push(row[5]);
  }

  return { exercises, workoutTypes, focusAreas, intensities, climbingTypes, trackingModes };
});

export const getRecentLogs = createServerFn({ method: "GET" }).middleware([appSecretAuth]).handler(async () => {
  const rows = await getValues("Workout%20Log!A5:P1000");
  const populated = rows.filter((r) => r[4]); // Exercise col
  const recent = populated.slice(-15).reverse().map((r) => ({
    date: r[0] ?? "",
    workoutType: r[2] ?? "",
    focusArea: r[3] ?? "",
    exercise: r[4] ?? "",
    sets: r[5] ?? "",
    reps: r[6] ?? "",
    weight: r[7] ?? "",
    duration: r[8] ?? "",
    intensity: r[9] ?? "",
    rpe: r[10] ?? "",
    restTime: r[11] ?? "",
    completed: (r[12] ?? "").toString().toUpperCase() === "TRUE",
    notes: r[15] ?? "",
  }));
  return { recent };
});

const shortText = (max = 200) => z.string().max(max).default("");
const longText = (max = 2000) => z.string().max(max).default("");

// Coerce numeric strings to numbers so Sheets stores them as numbers (not text)
// under RAW valueInputOption. Returns "" for empty / non-numeric input.
const num = (v: string | undefined | null): number | "" => {
  if (v == null) return "";
  const t = v.toString().trim();
  if (!t) return "";
  const n = Number(t);
  return Number.isFinite(n) ? n : "";
};

const WorkoutInput = z.object({
  date: z.string().min(1).max(40),
  workoutType: shortText(100),
  focusArea: shortText(100),
  exercise: z.string().min(1).max(200),
  sets: shortText(20),
  reps: shortText(40),
  weight: shortText(40),
  duration: shortText(20),
  intensity: shortText(60),
  rpe: shortText(20),
  restTime: shortText(40),
  completed: z.boolean().default(true),
  notes: longText(2000),
});

export const addWorkout = createServerFn({ method: "POST" }).middleware([appSecretAuth])
  .inputValidator((d: unknown) => WorkoutInput.parse(d))
  .handler(async ({ data }) => {
    const row = await findNextEmptyLogRow();
    // Skip B (Day), N (Consistency Credit), O (Volume), Q (Week Start), R (Month) — all formulas.
    // Write A, C:M, P.
    await batchUpdateValues([
      { range: `Workout Log!A${row}`, values: [[toSheetsSerial(data.date)]] },
      {
        range: `Workout Log!C${row}:M${row}`,
        values: [[
          data.workoutType,
          data.focusArea,
          data.exercise,
          num(data.sets),
          num(data.reps),
          num(data.weight),
          num(data.duration),
          data.intensity,
          num(data.rpe),
          data.restTime,
          data.completed ? "TRUE" : "FALSE",
        ]],
      },
      { range: `Workout Log!P${row}`, values: [[data.notes]] },
    ]);
    return { ok: true, row };
  });

// ===== Climbing =====

export const getRecentClimbs = createServerFn({ method: "GET" }).middleware([appSecretAuth]).handler(async () => {
  const rows = await getValues("Climbing%20Log!A10:L1000");
  const populated = rows.filter((r) => r[0]);
  const recent = populated.slice(-15).reverse().map((r) => ({
    date: r[0] ?? "",
    type: r[2] ?? "",
    trackingMode: r[3] ?? "",
    hours: r[4] ?? "",
    boulders: r[5] ?? "",
    grade: r[6] ?? "",
    gradient: r[7] ?? "",
    intensity: r[8] ?? "",
    rpe: r[9] ?? "",
    completed: (r[10] ?? "").toString().toUpperCase() === "TRUE",
    notes: r[11] ?? "",
  }));
  return { recent };
});

const ClimbInput = z.object({
  date: z.string().min(1).max(40),
  type: shortText(100),
  trackingMode: shortText(100),
  hours: shortText(20),
  boulders: shortText(40),
  grade: shortText(40),
  gradient: shortText(20),
  intensity: shortText(60),
  rpe: shortText(20),
  completed: z.boolean().default(true),
  notes: longText(2000),
});

export const addClimb = createServerFn({ method: "POST" }).middleware([appSecretAuth])
  .inputValidator((d: unknown) => ClimbInput.parse(d))
  .handler(async ({ data }) => {
    const row = await findNextEmptyClimbRow();
    // Skip B (Day), M (Week Start), N (Month) — formulas. Write A, C:L.
    await batchUpdateValues([
      { range: `Climbing Log!A${row}`, values: [[toSheetsSerial(data.date)]] },
      {
        range: `Climbing Log!C${row}:L${row}`,
        values: [[
          data.type,
          data.trackingMode,
          num(data.hours),
          num(data.boulders),
          data.grade,
          data.gradient,
          data.intensity,
          num(data.rpe),
          data.completed ? "TRUE" : "FALSE",
          data.notes,
        ]],
      },
    ]);
    return { ok: true, row };
  });


// ===== Calisthenics / Skills =====

export const getSkillsLibrary = createServerFn({ method: "GET" }).middleware([appSecretAuth]).handler(async () => {
  const rows = await getValues("Skills%20Tracker!B10:C30");
  const skills = rows
    .filter((r) => r[0])
    .map((r) => ({ name: r[0], category: r[1] ?? "" }));
  return {
    skills,
    sessionTypes: ["Skill", "Strength", "Endurance", "Technique", "Project", "Flash"],
    qualities: ["Poor", "Okay", "Good", "Great"],
  };
});

export const getRecentSkills = createServerFn({ method: "GET" }).middleware([appSecretAuth]).handler(async () => {
  const rows = await getValues("Skills%20Tracker!A41:O500");
  const populated = rows.filter((r) => r[1]);
  const recent = populated.slice(-15).reverse().map((r) => ({
    date: r[0] ?? "",
    skill: r[1] ?? "",
    category: r[2] ?? "",
    progression: r[3] ?? "",
    sessionType: r[4] ?? "",
    attempts: r[5] ?? "",
    sets: r[6] ?? "",
    bestHold: r[7] ?? "",
    bestReps: r[8] ?? "",
    assistance: r[9] ?? "",
    quality: r[10] ?? "",
    completed: (r[11] ?? "").toString().toUpperCase() === "TRUE",
    notes: r[14] ?? "",
  }));
  return { recent };
});

const SkillInput = z.object({
  date: z.string().min(1).max(40),
  skill: z.string().min(1).max(200),
  category: shortText(100),
  progression: shortText(200),
  sessionType: shortText(60),
  attempts: shortText(20),
  sets: shortText(20),
  bestHold: shortText(20),
  bestReps: shortText(20),
  assistance: shortText(100),
  quality: shortText(40),
  completed: z.boolean().default(true),
  notes: longText(2000),
});

export const addSkillSession = createServerFn({ method: "POST" }).middleware([appSecretAuth])
  .inputValidator((d: unknown) => SkillInput.parse(d))
  .handler(async ({ data }) => {
    const row = await findNextEmptySkillRow();
    await batchUpdateValues([
      {
        range: `Skills Tracker!A${row}:L${row}`,
        values: [[
          toSheetsSerial(data.date),
          data.skill,
          data.category,
          data.progression,
          data.sessionType,
          num(data.attempts),
          num(data.sets),
          num(data.bestHold),
          num(data.bestReps),
          data.assistance,
          data.quality,
          data.completed ? "TRUE" : "FALSE",
        ]],
      },
      { range: `Skills Tracker!O${row}`, values: [[data.notes]] },
    ]);
    return { ok: true, row };
  });

// ===== 1RM =====

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

export const get1RMRecent = createServerFn({ method: "GET" })
  .middleware([appSecretAuth])
  .handler(async () => {
    const [tests, bw] = await Promise.all([
      getValues("1RM%20Tracker!A70:R200"),
      getValues("1RM%20Tracker!J7:L60"),
    ]);
    const recent = tests
      .filter((r) => r[3])
      .slice(-15)
      .reverse()
      .map((r) => ({
        date: r[0] ?? "",
        source: r[2] ?? "",
        exercise: r[3] ?? "",
        type: r[4] ?? "",
        externalWeight: r[8] ?? "",
        reps: r[9] ?? "",
        rpe: r[10] ?? "",
        estTotal: r[13] ?? "",
        estExternal: r[14] ?? "",
        pr: (r[15] ?? "").toString().includes("PR"),
      }));
    const bodyweight = bw
      .filter((r) => r[0])
      .slice(-10)
      .reverse()
      .map((r) => ({ date: r[0] ?? "", bodyweight: r[1] ?? "", notes: r[2] ?? "" }));
    const latestBodyweight = bodyweight[0]?.bodyweight ?? "";
    return { recent, bodyweight, latestBodyweight };
  });

const OneRMInput = z.object({
  date: z.string().min(1).max(40),
  source: shortText(60),
  exercise: z.string().min(1).max(200),
  type: shortText(60),
  bodyweightUsed: z.boolean().default(false),
  bwContribution: shortText(20), // e.g. "100%" or 1 / 0.65
  externalWeight: shortText(40),
  reps: shortText(20),
  rpe: shortText(20),
  formula: shortText(20), // Brzycki | Epley
});

export const add1RMTest = createServerFn({ method: "POST" })
  .middleware([appSecretAuth])
  .inputValidator((d: unknown) => OneRMInput.parse(d))
  .handler(async ({ data }) => {
    const row = await findNextEmpty1RMRow();
    // Skip B (Week Start), H (Latest Bodyweight), L? L=Formula is user input.
    // Skip M..R (formulas).
    // Write A; C:G; I:L individually.
    await batchUpdateValues([
      { range: `1RM Tracker!A${row}`, values: [[toSheetsSerial(data.date)]] },
      {
        range: `1RM Tracker!C${row}:G${row}`,
        values: [[
          data.source,
          data.exercise,
          data.type,
          data.bodyweightUsed ? "TRUE" : "FALSE",
          data.bwContribution,
        ]],
      },
      {
        range: `1RM Tracker!I${row}:L${row}`,
        values: [[num(data.externalWeight), num(data.reps), num(data.rpe), data.formula]],
      },
    ]);
    return { ok: true, row };
  });

const BodyweightInput = z.object({
  date: z.string().min(1).max(40),
  bodyweight: z.string().min(1).max(20),
  notes: longText(500),
});

export const addBodyweight = createServerFn({ method: "POST" })
  .middleware([appSecretAuth])
  .inputValidator((d: unknown) => BodyweightInput.parse(d))
  .handler(async ({ data }) => {
    const row = await findNextEmptyBodyweightRow();
    await batchUpdateValues([
      {
        range: `1RM Tracker!J${row}:L${row}`,
        values: [[toSheetsSerial(data.date), num(data.bodyweight), data.notes]],
      },
    ]);
    return { ok: true, row };
  });

// ===== PRs =====

export type OneRMPR = {
  exercise: string;
  date: string;
  type: string;
  externalWeight: string;
  reps: string;
  estTotal: string;
  estExternal: string;
};

export type SkillPR = {
  skill: string;
  progression: string;
  metric: "hold" | "reps";
  value: number;
  unit: string;
  date: string;
};

const toNum = (v: unknown): number => {
  if (v == null) return NaN;
  const t = v.toString().trim();
  if (!t) return NaN;
  // strip non-numeric units (e.g. "12s", "30kg")
  const m = t.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

export const getPRs = createServerFn({ method: "GET" })
  .middleware([appSecretAuth])
  .handler(async () => {
    const [tests, skills] = await Promise.all([
      getValues("1RM%20Tracker!A70:R200"),
      getValues("Skills%20Tracker!A41:O500"),
    ]);

    // 1RM PRs: rows flagged as PR in column P (index 15). Keep latest per exercise.
    const oneRmAll: OneRMPR[] = tests
      .filter((r) => r[3] && (r[15] ?? "").toString().includes("PR"))
      .map((r) => ({
        exercise: r[3] ?? "",
        date: r[0] ?? "",
        type: r[4] ?? "",
        externalWeight: r[8] ?? "",
        reps: r[9] ?? "",
        estTotal: r[13] ?? "",
        estExternal: r[14] ?? "",
      }));
    const oneRmByEx = new Map<string, OneRMPR>();
    for (const pr of oneRmAll) {
      const cur = oneRmByEx.get(pr.exercise);
      const curBest = toNum(cur?.estTotal);
      const newBest = toNum(pr.estTotal);
      if (!cur || (Number.isFinite(newBest) && (!Number.isFinite(curBest) || newBest > curBest))) {
        oneRmByEx.set(pr.exercise, pr);
      }
    }
    const oneRm = Array.from(oneRmByEx.values()).sort((a, b) =>
      a.exercise.localeCompare(b.exercise),
    );

    // Skill PRs: best hold and best reps per skill+progression across all rows.
    const skillBest = new Map<string, { hold?: SkillPR; reps?: SkillPR }>();
    for (const r of skills) {
      const skill = (r[1] ?? "").toString().trim();
      if (!skill) continue;
      const progression = (r[3] ?? "").toString().trim();
      const date = r[0] ?? "";
      const hold = toNum(r[7]);
      const reps = toNum(r[8]);
      const key = `${skill}::${progression}`;
      const entry = skillBest.get(key) ?? {};
      if (Number.isFinite(hold) && hold > 0) {
        if (!entry.hold || hold > entry.hold.value) {
          entry.hold = {
            skill,
            progression,
            metric: "hold",
            value: hold,
            unit: "s",
            date,
          };
        }
      }
      if (Number.isFinite(reps) && reps > 0) {
        if (!entry.reps || reps > entry.reps.value) {
          entry.reps = {
            skill,
            progression,
            metric: "reps",
            value: reps,
            unit: "reps",
            date,
          };
        }
      }
      skillBest.set(key, entry);
    }
    const skillPRs: SkillPR[] = [];
    for (const entry of skillBest.values()) {
      if (entry.hold) skillPRs.push(entry.hold);
      if (entry.reps) skillPRs.push(entry.reps);
    }
    skillPRs.sort(
      (a, b) =>
        a.skill.localeCompare(b.skill) ||
        a.progression.localeCompare(b.progression) ||
        a.metric.localeCompare(b.metric),
    );

    return { oneRm, skills: skillPRs };
  });
