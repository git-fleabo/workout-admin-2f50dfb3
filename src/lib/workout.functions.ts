import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  batchUpdateValues,
  findNextEmptyLogRow,
  getValues,
} from "./sheets.server";

export const getLibrary = createServerFn({ method: "GET" }).handler(async () => {
  const [libRaw, settingsRaw] = await Promise.all([
    getValues("Exercise%20Library!A5:H200"),
    getValues("Settings!A14:D40"),
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

  // Settings A14:D40 — headers in first row, then columns of dropdown lists.
  const workoutTypes: string[] = [];
  const focusAreas: string[] = [];
  const intensities: string[] = [];
  for (let i = 1; i < settingsRaw.length; i++) {
    const row = settingsRaw[i] ?? [];
    if (row[0]) workoutTypes.push(row[0]);
    if (row[1]) focusAreas.push(row[1]);
    if (row[2]) intensities.push(row[2]);
  }

  return { exercises, workoutTypes, focusAreas, intensities };
});

export const getRecentLogs = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await getValues("Workout%20Log!A5:O1000");
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
    completed: (r[11] ?? "").toString().toUpperCase() === "TRUE",
    notes: r[14] ?? "",
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
  completed: z.boolean().default(true),
  notes: z.string().default(""),
});

export const addWorkout = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => WorkoutInput.parse(d))
  .handler(async ({ data }) => {
    const row = await findNextEmptyLogRow();
    // Skip column B (Day formula). Write A, then C:L, then O (Notes).
    await batchUpdateValues([
      { range: `Workout Log!A${row}`, values: [[data.date]] },
      {
        range: `Workout Log!C${row}:L${row}`,
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
          data.completed ? "TRUE" : "FALSE",
        ]],
      },
      { range: `Workout Log!O${row}`, values: [[data.notes]] },
    ]);
    return { ok: true, row };
  });
