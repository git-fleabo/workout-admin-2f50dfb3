import { z } from "zod";

const stringRecordSchema = z.record(z.union([z.string(), z.number(), z.boolean()]));
const loadSemanticsSchema = z.union([
  z.literal(""),
  z.enum([
    "total_external_load",
    "per_implement_load",
    "combined_implement_load",
    "added_bodyweight_load",
    "assistance",
    "bodyweight_contribution",
    "none",
    "unknown",
  ]),
]);

const setSegmentSchema = z.object({
  reps: z.string(),
  weight: z.string(),
  rpe: z.string(),
  restAfterSeconds: z.string(),
  rangeOfMotion: z.string(),
});

const setMethodSchema = z.object({
  trainingMethodId: z.string(),
  methodName: z.string(),
  systemKey: z.string().nullable().optional(),
  segments: z.array(setSegmentSchema),
  config: stringRecordSchema,
});

const workoutSetSchema = z.object({
  reps: z.string(),
  weight: z.string(),
  durationSeconds: z.string(),
  rpe: z.string(),
  completed: z.boolean(),
  method: setMethodSchema.optional(),
});

const workoutEntrySchema = z.object({
  clientId: z.string(),
  date: z.string().min(1, "Date is required"),
  entryKind: z.string(),
  workoutType: z.string(),
  focusArea: z.string(),
  exercise: z.string(),
  sets: z.string(),
  reps: z.string(),
  weight: z.string(),
  duration: z.string(),
  intensity: z.string(),
  rpe: z.string(),
  restTime: z.string(),
  completed: z.boolean(),
  notes: z.string(),
  progressionLevel: z.string(),
  holdSeconds: z.string(),
  assistanceType: z.string(),
  assistanceDetail: z.string(),
  quality: z.string(),
  technique: z.string(),
  pain: z.string(),
  gripStyle: z.string(),
  gripLoadType: z.string(),
  climbingTrackingMode: z.string(),
  climbingHours: z.string(),
  climbingBoulders: z.string(),
  climbingMaxGrade: z.string(),
  climbingGradient: z.string(),
  loadSemantics: loadSemanticsSchema,
  distance: z.string(),
  distanceUnit: z.string(),
  rounds: z.string(),
  feel: z.string(),
  height: z.string(),
  positionMeasurementCm: z.string(),
  positionMeasurementSetup: z.string(),
  detail: z.string(),
  setRows: z.array(workoutSetSchema).min(1),
});

const methodBlockSchema = z.object({
  id: z.string(),
  trainingMethodId: z.string(),
  methodName: z.string(),
  family: z.enum(["exercise_group", "timed_density"]),
  memberClientIds: z.array(z.string()),
  rounds: z.string(),
  restBetweenMovementsSeconds: z.string(),
  restBetweenRoundsSeconds: z.string(),
  blockDurationMinutes: z.string(),
  workIntervalSeconds: z.string(),
  restIntervalSeconds: z.string(),
  completedRounds: z.string(),
  config: stringRecordSchema,
});

export const workoutSessionSchema = z.object({
  date: z.string(),
  title: z.string(),
  trainingLocationId: z.string().min(1, "Training location is required"),
  duration: z.string(),
  intensity: z.string(),
  rpe: z.string(),
  completed: z.boolean(),
  notes: z.string(),
  entries: z.array(workoutEntrySchema).min(1),
  methodBlocks: z.array(methodBlockSchema),
});
