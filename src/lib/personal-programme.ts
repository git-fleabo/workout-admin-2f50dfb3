import { z } from "zod";
import { programmeWorkoutScheduledDate } from "./adaptive-strength.ts";
import { buildProgrammeMovementPrescription } from "./programme-prescription.ts";
import { FIXED_PROGRESSION, type ProgrammeProgression } from "./programme-progression.ts";
import type { ProgrammeAssignmentInput, ProgrammeTemplate } from "./supabase-programmes.browser.ts";
import type { WorkoutPlanMovement } from "./workout-plan.ts";
import { getTrackingModeValue } from "./movement-metrics.ts";

export type PersonalProgrammeMovement = WorkoutPlanMovement & {
  exerciseId: string;
  programmeKey: string;
  progression: ProgrammeProgression;
  baseStrength?: BaseStrengthMovementRule;
};
export type PersonalProgrammePlan = {
  version: 1;
  locationKind: "home" | "gym";
  movements: PersonalProgrammeMovement[];
  baseStrength?: "volume_intensity" | "bullmastiff";
};
export type PersonalProgrammeSession = {
  reviewedPlan?: PersonalProgrammePlan;
  strengthReviewId?: string;
  workoutId: string;
  revision: number;
  name: string;
  scheduledDate: string;
  plan: PersonalProgrammePlan;
};
export type PersonalProgramme = { name: string; sessions: PersonalProgrammeSession[] };

export function programmeExerciseTrackingMode(exercise: {
  name: string;
  workoutType: string;
  metric: string;
}): PersonalProgrammeMovement["trackingMode"] | null {
  const mode = getTrackingModeValue({
    workoutType: exercise.workoutType,
    movement: exercise.name,
    defaultMetric: exercise.metric,
  });
  return mode === "weight_reps" || mode === "reps_only" || mode === "hold" || mode === "grip_hold"
    ? mode
    : null;
}

const numericText = (max: number) =>
  z
    .string()
    .refine(
      (value) => value === "" || (/^\d+(\.\d+)?$/.test(value) && Number(value) <= max),
      "Use a positive number or leave blank",
    );
export const baseStrengthMovementSchema = z.object({
  programme: z.enum(["volume_intensity", "bullmastiff"]),
  week: z.number().int().min(1).max(30),
  phase: z.enum(["base", "build", "peak"]),
  wave: z.number().int().min(1).max(4),
  waveWeek: z.number().int().min(1).max(3),
  role: z.enum(["main", "variation", "accessory"]),
  referenceMax: z.number().positive().max(1000).nullable(),
  percent: z.number().positive().max(100).nullable(),
  plusLastSet: z.boolean(),
  incrementKg: z.number().positive().max(100),
  approvedFingerprint: z
    .string()
    .regex(/^[a-f0-9]{32}$/)
    .optional(),
});
export type BaseStrengthMovementRule = z.infer<typeof baseStrengthMovementSchema>;
export const progressionSchema = z
  .object({
    type: z.enum(["fixed", "double", "source"]),
    minReps: z.number().int().min(1).max(100),
    maxReps: z.number().int().min(1).max(100),
    incrementKg: z.number().positive().max(100),
    maxRpe: z.number().min(1).max(10),
  })
  .refine(
    (rule) => rule.maxReps >= rule.minReps,
    "The upper rep target must be at least the lower target",
  );
export const personalPlanSchema = z
  .object({
    version: z.literal(1),
    locationKind: z.enum(["home", "gym"]),
    baseStrength: z.enum(["volume_intensity", "bullmastiff"]).optional(),
    movements: z
      .array(
        z
          .object({
            exerciseId: z.string().uuid(),
            programmeKey: z.string().min(1).max(128),
            exercise: z.string().trim().min(1).max(200),
            workoutType: z.string().max(100),
            trackingMode: z.enum(["weight_reps", "reps_only", "hold", "grip_hold"]),
            targets: z.object({
              durationMinutes: z.string(),
              distance: z.string(),
              distanceUnit: z.string(),
              rounds: z.string(),
              height: z.string(),
              detail: z.string(),
            }),
            sourceDate: z.string(),
            reason: z.string().max(4000),
            restTime: z.string().max(100).optional(),
            progression: progressionSchema,
            baseStrength: baseStrengthMovementSchema.optional(),
            setRows: z
              .array(
                z.object({
                  reps: numericText(1000),
                  weight: numericText(1000),
                  durationSeconds: numericText(86400),
                  rpe: numericText(10),
                  completed: z.boolean(),
                }),
              )
              .min(1)
              .max(20),
          })
          .refine(
            (movement) =>
              movement.progression.type !== "double" || movement.trackingMode === "weight_reps",
            "Rep-range progression needs a load and reps exercise",
          ),
      )
      .min(1)
      .max(30),
  })
  .refine(
    (plan) =>
      new Set(plan.movements.map((movement) => movement.programmeKey)).size ===
      plan.movements.length,
    "Each movement needs its own identity",
  );

export function personalPlanFromTemplate(
  template: ProgrammeTemplate,
  input: ProgrammeAssignmentInput,
): PersonalProgrammeSession[] {
  const mapped = new Map(input.exercises.map((exercise) => [exercise.slotKey, exercise]));
  return template.workouts.map((workout) => {
    const occurrences = new Map<string, number>();
    const movements = workout.entries.flatMap((entry): PersonalProgrammeMovement[] => {
      if (entry.selectionRole) return [];
      const mapping = entry.slotKey ? mapped.get(entry.slotKey) : undefined;
      const exerciseId = mapping?.exerciseId ?? entry.exerciseId;
      if (mapping?.enabled === false || !exerciseId) {
        if (entry.isOptional) return [];
        throw new Error(`Choose a Library exercise for ${entry.name} first.`);
      }
      const movement = buildProgrammeMovementPrescription({
        entry,
        methodType: template.methodType,
        defaultSetChoice: template.defaultSetChoice,
        exercise: {
          exerciseName: mapping?.exerciseName ?? entry.name,
          focusArea: mapping?.focusArea ?? null,
          trainingMax: mapping?.trainingMax ?? null,
          loadAdjustmentPercent: 0,
          manualAdjustmentPercent: 0,
          lastDecision: null,
        },
      });
      if (!movement) throw new Error(`Targets could not be prepared for ${entry.name}.`);
      const baseKey = entry.slotKey ?? exerciseId;
      const occurrence = occurrences.get(baseKey) ?? 0;
      occurrences.set(baseKey, occurrence + 1);
      return [
        {
          ...movement,
          reason: movement.reason ? `Starting model guidance: ${movement.reason}` : "",
          setRows: movement.setRows.map((set) => ({
            ...set,
            durationSeconds: set.durationSeconds ?? "",
          })),
          exerciseId,
          programmeKey: `${baseKey}:${occurrence}`,
          progression: {
            ...FIXED_PROGRESSION,
            type: template.methodType === "jacked_dumbbell" ? "source" : "fixed",
          },
        },
      ];
    });
    if (!movements.length) throw new Error(`Choose at least one exercise for ${workout.name}.`);
    return {
      workoutId: workout.id,
      revision: 0,
      name: workout.name,
      scheduledDate:
        programmeWorkoutScheduledDate(input.startedOn, workout.weekNumber, workout.dayNumber) ??
        input.startedOn,
      plan: personalPlanSchema.parse({ version: 1, locationKind: "gym", movements }),
    };
  });
}

// Only changes the same original exercise slots. Other sessions keep their own sequence,
// dates, exercises, and periodised targets unless this explicit propagation is requested.
export function propagateProgrammeChanges(
  before: PersonalProgrammeSession,
  after: PersonalProgrammeSession,
  later: PersonalProgrammeSession[],
): PersonalProgrammeSession[] {
  const original = new Map(
    before.plan.movements.map((movement) => [movement.programmeKey, movement]),
  );
  const changed = new Map(
    after.plan.movements
      .filter(
        (movement) =>
          original.has(movement.programmeKey) &&
          JSON.stringify(original.get(movement.programmeKey)) !== JSON.stringify(movement),
      )
      .map((movement) => [movement.programmeKey, movement]),
  );
  const removed = new Set(
    before.plan.movements
      .filter(
        (movement) =>
          !after.plan.movements.some((item) => item.programmeKey === movement.programmeKey),
      )
      .map((movement) => movement.programmeKey),
  );
  return later.flatMap((session) => {
    const movements = session.plan.movements
      .filter((movement) => !removed.has(movement.programmeKey))
      .map((movement) => changed.get(movement.programmeKey) ?? movement);
    if (JSON.stringify(movements) === JSON.stringify(session.plan.movements)) return [];
    if (!movements.length)
      throw new Error(`${session.name} would have no exercises. Edit that session separately.`);
    return [{ ...session, plan: { ...session.plan, movements } }];
  });
}
