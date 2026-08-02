import {
  effectiveIntensityPercent,
  programmeWeightIncrementKg,
  suggestedRestForIntensity,
  type AdaptiveDecision,
} from "./adaptive-strength.ts";
import { getProgrammeMethodSetup } from "./programme-methods.ts";
import type { WorkoutPlanMovement } from "./workout-plan.ts";

export type ProgrammePrescriptionEntry = {
  name: string;
  minSets: number | null;
  maxSets: number | null;
  minReps: number | null;
  maxReps: number | null;
  intensityPercent: number | null;
  intensityMinPercent: number | null;
  intensityMaxPercent: number | null;
  roundingIncrement: number | null;
  rpeCap: number | null;
  rest: string | null;
  notes: string | null;
  isOptional: boolean;
};

export type ProgrammePrescriptionExercise = {
  exerciseName: string;
  focusArea: string | null;
  trainingMax: number | null;
  loadAdjustmentPercent: number;
  manualAdjustmentPercent: number;
  lastDecision: AdaptiveDecision | null;
};

export function buildProgrammeMovementPrescription(input: {
  entry: ProgrammePrescriptionEntry;
  exercise: ProgrammePrescriptionExercise;
  methodType: string | null;
  defaultSetChoice: string | null;
}): WorkoutPlanMovement | null {
  const method = getProgrammeMethodSetup(input.methodType);
  if (!method) return null;

  const plannedIntensity = effectiveIntensityPercent({
    minimum: input.entry.intensityMinPercent ?? input.entry.intensityPercent,
    maximum: input.entry.intensityMaxPercent ?? input.entry.intensityPercent,
    adjustment: input.exercise.loadAdjustmentPercent + input.exercise.manualAdjustmentPercent,
  });
  const setRows = method.buildSetRows({
    minimumSets: input.entry.minSets,
    maximumSets: input.entry.maxSets,
    minimumReps: input.entry.minReps,
    maximumReps: input.entry.maxReps,
    setChoice: input.defaultSetChoice,
    intensityPercent: plannedIntensity,
    trainingMax: input.exercise.trainingMax,
    roundingIncrement: programmeWeightIncrementKg(input.exercise.focusArea),
  });
  if (!setRows.length) return null;

  const restTime = input.entry.rest?.trim() || suggestedRestForIntensity(plannedIntensity);
  return {
    exercise: input.exercise.exerciseName,
    workoutType: method.workoutType,
    trackingMode: "weight_reps",
    targets: {
      durationMinutes: "",
      distance: "",
      distanceUnit: "",
      rounds: "",
      height: "",
      detail: "",
    },
    sourceDate: "",
    reason: [
      plannedIntensity != null && input.exercise.trainingMax != null
        ? `${plannedIntensity}% of ${input.exercise.trainingMax} kg training max.`
        : null,
      input.entry.intensityMinPercent != null && input.entry.intensityMaxPercent != null
        ? `Planned range ${input.entry.intensityMinPercent}-${input.entry.intensityMaxPercent}%; start at the safe end.`
        : null,
      input.entry.rpeCap != null ? `RPE cap ${input.entry.rpeCap}.` : null,
      restTime ? `Rest ${restTime} between sets.` : null,
      input.exercise.lastDecision ? `Last review: ${input.exercise.lastDecision}.` : null,
      input.entry.isOptional ? "Optional movement." : null,
      input.entry.notes,
    ]
      .filter(Boolean)
      .join(" "),
    restTime,
    setRows: setRows.map((set) => ({ ...set, durationSeconds: "" })),
  };
}
