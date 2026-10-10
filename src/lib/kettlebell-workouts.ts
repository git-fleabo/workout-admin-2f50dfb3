import { z } from "zod";
import type { WorkoutPlanDraft } from "./workout-plan.ts";

export const KETTLEBELL_CATEGORIES = ["strength", "muscle", "conditioning"] as const;
export type KettlebellCategory = (typeof KETTLEBELL_CATEGORIES)[number];
export type KettlebellSelection = KettlebellCategory | "random";
export const KETTLEBELL_OPTIONS = [
  { value: "strength", label: "Strength" },
  { value: "muscle", label: "Muscle" },
  { value: "conditioning", label: "Conditioning" },
  { value: "random", label: "Random" },
] as const;

const numericText = (maximum: number) =>
  z
    .string()
    .max(32)
    .refine(
      (value) => value === "" || (/^\d+(\.\d+)?$/.test(value) && Number(value) <= maximum),
      "Use a positive number or leave blank",
    );
const targetsSchema = z
  .object({
    durationMinutes: numericText(1440),
    distance: numericText(100000),
    distanceUnit: z.string().max(20),
    rounds: numericText(1000),
    height: numericText(1000),
    detail: z.string().max(8000),
  })
  .strict();
const integerText = (maximum: number) =>
  numericText(maximum).refine(
    (value) => value === "" || Number.isInteger(Number(value)),
    "Use a whole number",
  );
export const kettlebellPrescriptionSchema = z
  .object({
    movements: z
      .array(
        z
          .object({
            exerciseId: z.string().uuid(),
            exercise: z.string().trim().min(1).max(200),
            workoutType: z.enum(["Strength", "Conditioning"]),
            trackingMode: z.enum([
              "weight_reps",
              "reps_only",
              "hold",
              "duration",
              "conditioning",
              "carry",
            ]),
            targets: targetsSchema,
            sourceDate: z.literal(""),
            reason: z.string().max(8000),
            restTime: z.string().max(200).optional(),
            setRows: z
              .array(
                z
                  .object({
                    reps: numericText(1000),
                    weight: numericText(1000),
                    durationSeconds: numericText(86400),
                    rpe: numericText(10),
                    completed: z.boolean(),
                  })
                  .strict()
                  .refine(
                    (set) => Number(set.reps) > 0 || Number(set.durationSeconds) > 0,
                    "Each set needs reps or duration",
                  ),
              )
              .min(1)
              .max(100),
          })
          .strict(),
      )
      .min(1)
      .max(50),
    methodBlocks: z
      .array(
        z
          .object({
            trainingMethodId: z.string().uuid(),
            methodName: z.string().min(1).max(200),
            family: z.enum(["exercise_group", "timed_density"]),
            memberMovementIndexes: z.array(z.number().int().min(0)).min(1).max(50),
            rounds: integerText(1000),
            restBetweenMovementsSeconds: integerText(86400),
            restBetweenRoundsSeconds: integerText(86400),
            blockDurationMinutes: numericText(1440),
            workIntervalSeconds: integerText(86400),
            restIntervalSeconds: integerText(86400),
            config: z.record(z.union([z.string().max(8000), z.number().finite(), z.boolean()])),
          })
          .strict(),
      )
      .max(30)
      .default([]),
  })
  .strict()
  .superRefine((plan, context) => {
    plan.methodBlocks.forEach((block, index) => {
      if (
        block.memberMovementIndexes.some((member) => member >= plan.movements.length) ||
        new Set(block.memberMovementIndexes).size !== block.memberMovementIndexes.length ||
        (block.family === "exercise_group" && block.memberMovementIndexes.length < 2)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["methodBlocks", index],
          message: "Invalid movement group",
        });
      }
    });
  });

export const kettlebellWorkoutSchema = z
  .object({
    id: z.string().uuid(),
    category: z.enum(KETTLEBELL_CATEGORIES),
    collectionKey: z.literal("strong_on"),
    sourceNumber: z.number().int().positive(),
    title: z.string().trim().min(1).max(200),
    summary: z.string().max(2000),
    instructions: z.string().trim().min(1).max(16000),
    sourceReference: z.string().max(500),
    bellCount: z.union([z.literal(1), z.literal(2)]),
    requiredEquipmentIds: z.array(z.string().uuid()).max(30),
    durationMinutes: z.number().positive().max(20).nullable(),
    version: z.number().int().positive(),
    isAvailable: z.boolean(),
    verified: z.boolean(),
    prescription: kettlebellPrescriptionSchema,
  })
  .strict();
export type KettlebellWorkout = z.infer<typeof kettlebellWorkoutSchema>;
export type KettlebellEquipment = {
  locationId: string;
  bellCount: 1 | 2;
  hasKettlebells: boolean;
  equipmentIds: string[];
  enabledExerciseIds: string[];
};

export function eligibleKettlebellWorkouts(
  workouts: KettlebellWorkout[],
  category: KettlebellSelection,
  equipment: KettlebellEquipment,
) {
  if (!equipment.hasKettlebells) return [];
  const available = new Set(equipment.equipmentIds);
  const enabled = new Set(equipment.enabledExerciseIds);
  return workouts.filter(
    (workout) =>
      workout.verified &&
      workout.isAvailable &&
      KETTLEBELL_CATEGORIES.includes(workout.category) &&
      (category === "random" || category === workout.category) &&
      workout.bellCount <= equipment.bellCount &&
      workout.requiredEquipmentIds.every((id) => available.has(id)) &&
      workout.prescription.movements.every((movement) => enabled.has(movement.exerciseId)),
  );
}

export function pickKettlebellWorkout(
  workouts: KettlebellWorkout[],
  offeredIds: string[],
  recentIds: string[] = [],
  random = Math.random,
) {
  const unseen = workouts.filter((workout) => !offeredIds.includes(workout.id));
  const fresh = unseen.filter((workout) => !recentIds.includes(workout.id));
  const pool = fresh.length ? fresh : unseen;
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
}

export function kettlebellWorkoutDraft(
  workout: KettlebellWorkout,
  location: { id: string; kind: "home" | "gym" },
): WorkoutPlanDraft {
  const source = `Strong ON! · ${workout.category} ${workout.sourceNumber} · ${workout.sourceReference}`;
  return {
    version: 1,
    title: `${workout.title} · Strong ON! ${workout.category} ${workout.sourceNumber}`,
    locationKind: location.kind,
    trainingLocationId: location.id,
    basis: `${source}. Standalone kettlebell workout.`,
    movements: workout.prescription.movements.map((movement, index) => ({
      ...structuredClone(movement),
      reason: [source, index === 0 ? workout.instructions : "", movement.reason]
        .filter(Boolean)
        .join("\n\n"),
    })),
    methodBlocks: structuredClone(workout.prescription.methodBlocks),
  };
}

export const kettlebellPickerStateSchema = z
  .object({
    category: z.enum(["strength", "muscle", "conditioning", "random"]),
    locationId: z.string(),
    bellCount: z.union([z.literal(1), z.literal(2)]),
    offeredIds: z.array(z.string().uuid()).max(1000),
    previewId: z.string().uuid().nullable(),
    previewVersion: z.number().int().positive().nullable(),
    requestId: z.string().uuid(),
  })
  .strict();
export type KettlebellPickerState = z.infer<typeof kettlebellPickerStateSchema>;
export function readKettlebellPickerState(raw: string | null): KettlebellPickerState | null {
  try {
    const result = kettlebellPickerStateSchema.safeParse(JSON.parse(raw ?? "null"));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
