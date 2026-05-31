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
      { range: `Workout Log!A${row}`, values: [[data.date]] },
      {
        range: `Workout Log!C${row}:M${row}`,
        values: [[
          data.workoutType,
          data.focusArea,
          data.exercise,
          data.sets,
          data.reps,
          data.weight,
          data.duration,
          data.intensity,
          data.rpe,
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
      { range: `Climbing Log!A${row}`, values: [[data.date]] },
      {
        range: `Climbing Log!C${row}:L${row}`,
        values: [[
          data.type,
          data.trackingMode,
          data.hours,
          data.boulders,
          data.grade,
          data.gradient,
          data.intensity,
          data.rpe,
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
          data.date,
          data.skill,
          data.category,
          data.progression,
          data.sessionType,
          data.attempts,
          data.sets,
          data.bestHold,
          data.bestReps,
          data.assistance,
          data.quality,
          data.completed ? "TRUE" : "FALSE",
        ]],
      },
      { range: `Skills Tracker!O${row}`, values: [[data.notes]] },
    ]);
    return { ok: true, row };
  });
