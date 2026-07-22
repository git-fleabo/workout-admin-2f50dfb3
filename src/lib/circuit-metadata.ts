export const CIRCUIT_SUITABILITY_OPTIONS = [
  { value: "preferred", label: "Preferred" },
  { value: "available", label: "Available" },
  { value: "excluded", label: "Excluded" },
] as const;

export type CircuitSuitability = (typeof CIRCUIT_SUITABILITY_OPTIONS)[number]["value"];

export const CIRCUIT_MOVEMENT_PATTERN_OPTIONS = [
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "squat", label: "Squat" },
  { value: "hinge", label: "Hinge" },
  { value: "lunge", label: "Lunge" },
  { value: "carry", label: "Carry" },
  { value: "core", label: "Core" },
  { value: "locomotion", label: "Locomotion" },
  { value: "mobility", label: "Mobility" },
  { value: "power", label: "Power" },
  { value: "grip", label: "Grip" },
  { value: "full_body", label: "Full body" },
  { value: "skill", label: "Skill" },
  { value: "other", label: "Other" },
] as const;

export type CircuitMovementPattern = (typeof CIRCUIT_MOVEMENT_PATTERN_OPTIONS)[number]["value"];

export const CIRCUIT_DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

export type CircuitDifficulty = (typeof CIRCUIT_DIFFICULTY_OPTIONS)[number]["value"];

export const CIRCUIT_IMPACT_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
] as const;

export type CircuitImpact = (typeof CIRCUIT_IMPACT_OPTIONS)[number]["value"];

export const CIRCUIT_DOSE_MODE_OPTIONS = [
  { value: "reps", label: "Reps", suffix: "reps" },
  { value: "seconds", label: "Seconds", suffix: "sec" },
  { value: "metres", label: "Metres", suffix: "m" },
  { value: "rounds", label: "Rounds", suffix: "rounds" },
] as const;

export type CircuitDoseMode = (typeof CIRCUIT_DOSE_MODE_OPTIONS)[number]["value"];

export type CircuitMetadata = {
  circuitSuitability: CircuitSuitability;
  circuitPattern: CircuitMovementPattern;
  circuitDifficulty: CircuitDifficulty;
  circuitImpact: CircuitImpact;
  circuitDoseMode: CircuitDoseMode;
  circuitDoseMin: string;
  circuitDoseMax: string;
  circuitDosePerSide: boolean;
};

export const DEFAULT_CIRCUIT_METADATA: CircuitMetadata = {
  circuitSuitability: "available",
  circuitPattern: "other",
  circuitDifficulty: "intermediate",
  circuitImpact: "low",
  circuitDoseMode: "reps",
  circuitDoseMin: "6",
  circuitDoseMax: "10",
  circuitDosePerSide: false,
};

export function circuitDoseDefaultsForTrackingMode(trackingMode: string) {
  if (trackingMode === "carry") {
    return { circuitDoseMode: "metres" as const, circuitDoseMin: "20", circuitDoseMax: "40" };
  }
  if (trackingMode === "hold" || trackingMode === "grip_hold") {
    return { circuitDoseMode: "seconds" as const, circuitDoseMin: "15", circuitDoseMax: "30" };
  }
  if (
    ["distance_time", "duration", "conditioning", "mobility_position", "climbing"].includes(
      trackingMode,
    )
  ) {
    return { circuitDoseMode: "seconds" as const, circuitDoseMin: "30", circuitDoseMax: "60" };
  }
  if (trackingMode === "power") {
    return { circuitDoseMode: "reps" as const, circuitDoseMin: "3", circuitDoseMax: "5" };
  }
  return { circuitDoseMode: "reps" as const, circuitDoseMin: "6", circuitDoseMax: "10" };
}

export function circuitOptionLabel<T extends ReadonlyArray<{ value: string; label: string }>>(
  options: T,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function circuitDoseLabel(metadata: CircuitMetadata) {
  const suffix = CIRCUIT_DOSE_MODE_OPTIONS.find(
    (option) => option.value === metadata.circuitDoseMode,
  )?.suffix;
  const range = [metadata.circuitDoseMin, metadata.circuitDoseMax]
    .filter(Boolean)
    .filter((value, index, all) => index === 0 || value !== all[0])
    .join("–");
  if (!range) return "Dose not set";
  return `${range}${suffix ? ` ${suffix}` : ""}${metadata.circuitDosePerSide ? " / side" : ""}`;
}
