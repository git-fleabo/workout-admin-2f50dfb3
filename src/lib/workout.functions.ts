import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  batchUpdateValues,
  findNextEmptyClimbRow,
  findNextEmptyLogRow,
  findNextEmptySkillRow,
  getValues,
} from "./sheets.server";

export const REST_OPTIONS = [
  "0:30", "1:00", "1:30", "2:00", "2:30", "3:00", "3:30", "4:00", "4:30", "5:00",
];

export const getLibrary = createServerFn({ method: "GET" }).handler(async () => {
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

export const getRecentLogs = createServerFn({ method: "GET" }).handler(async () => {
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

const WorkoutInput = z.object({
  date: z.string().min(1),
  workoutType: z.string().default(""),
  focusArea: z.string().default(""),
  exercise: z.string().min(1),
  sets: z.string().default(""),
  reps: z.string().default(""),
  weight: z.string().default(""),
  duration: z.string().default(""),
  intensity: z.string().default(""),
  rpe: z.string().default(""),
  restTime: z.string().default(""),
  completed: z.boolean().default(true),
  notes: z.string().default(""),
});

export const addWorkout = createServerFn({ method: "POST" })
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

export const getRecentClimbs = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await getValues("Climbing%20Log!A10:K1000");
  const populated = rows.filter((r) => r[0]);
  const recent = populated.slice(-15).reverse().map((r) => ({
    date: r[0] ?? "",
    type: r[2] ?? "",
    trackingMode: r[3] ?? "",
    hours: r[4] ?? "",
    boulders: r[5] ?? "",
    grade: r[6] ?? "",
    intensity: r[7] ?? "",
    rpe: r[8] ?? "",
    completed: (r[9] ?? "").toString().toUpperCase() === "TRUE",
    notes: r[10] ?? "",
  }));
  return { recent };
});

const ClimbInput = z.object({
  date: z.string().min(1),
  type: z.string().default(""),
  trackingMode: z.string().default(""),
  hours: z.string().default(""),
  boulders: z.string().default(""),
  grade: z.string().default(""),
  intensity: z.string().default(""),
  rpe: z.string().default(""),
  completed: z.boolean().default(true),
  notes: z.string().default(""),
});

export const addClimb = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ClimbInput.parse(d))
  .handler(async ({ data }) => {
    const row = await findNextEmptyClimbRow();
    // Skip B (Day), L (Week Start), M (Month) — formulas. Write A, C:K.
    await batchUpdateValues([
      { range: `Climbing Log!A${row}`, values: [[data.date]] },
      {
        range: `Climbing Log!C${row}:K${row}`,
        values: [[
          data.type,
          data.trackingMode,
          data.hours,
          data.boulders,
          data.grade,
          data.intensity,
          data.rpe,
          data.completed ? "TRUE" : "FALSE",
          data.notes,
        ]],
      },
    ]);
    return { ok: true, row };
  });
