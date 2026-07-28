export type TechniqueRating = "good" | "acceptable" | "poor";
export type AdaptiveDecision = "progress" | "repeat" | "regress";

export type AdaptiveReviewInput = {
  completed: boolean;
  rpe: number | null;
  rpeCap: number | null;
  technique: TechniqueRating | null;
  pain: number | null;
};

export const ADAPTIVE_STRENGTH_METHOD = "adaptive_strength_12_week";

export const ADAPTIVE_STRENGTH_DEFAULTS: Record<
  string,
  { exerciseName: string; aliases?: string[]; trainingMax: number; enabled: boolean }
> = {
  bench_press: { exerciseName: "Bench Press", trainingMax: 75, enabled: true },
  high_bar_squat: { exerciseName: "High Bar Squat", trainingMax: 65, enabled: true },
  deadlift: { exerciseName: "Deadlift", trainingMax: 87.5, enabled: true },
  seated_dumbbell_press: {
    exerciseName: "Seated Dumbbell Press",
    aliases: ["Seated Dumbbell Shoulder Press"],
    trainingMax: 20,
    enabled: true,
  },
  weighted_pull_up: { exerciseName: "Weighted Pull-Up", trainingMax: 30, enabled: false },
};

export function decideAdaptiveProgression(input: AdaptiveReviewInput): AdaptiveDecision {
  if (!input.completed || input.technique === "poor" || (input.pain != null && input.pain >= 4)) {
    return "regress";
  }
  if (
    input.rpe == null ||
    input.technique == null ||
    input.pain == null ||
    input.technique === "acceptable" ||
    input.pain >= 2 ||
    (input.rpeCap != null && input.rpe > input.rpeCap)
  ) {
    return "repeat";
  }
  return "progress";
}

export function adjustmentForDecision(decision: AdaptiveDecision) {
  if (decision === "regress") return -5;
  if (decision === "repeat") return -2.5;
  return 0;
}

export function effectiveIntensityPercent(input: {
  minimum: number | null;
  maximum: number | null;
  adjustment: number | null;
}) {
  if (input.minimum == null) return null;
  const adjusted = input.minimum + (input.adjustment ?? 0);
  const ceiling = input.maximum ?? input.minimum;
  return Math.max(0, Math.min(adjusted, ceiling));
}

export function nextCycleTrainingMax(slotKey: string, current: number | null) {
  if (current == null) return null;
  if (slotKey === "seated_dumbbell_press") return current + 1;
  if (slotKey === "weighted_pull_up") return current;
  return current + 2.5;
}
