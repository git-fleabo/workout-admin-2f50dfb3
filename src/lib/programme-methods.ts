export type ProgrammeMethodSetup = {
  label: string;
  workoutType: string;
  trainingMax: {
    required: boolean;
    label: string;
    unit: string;
    minimum: number;
    step: number;
  } | null;
  buildSetRows: (input: ProgrammePrescriptionInput) => ProgrammePrescriptionSet[];
};

export type ProgrammePrescriptionInput = {
  minimumSets: number | null;
  maximumSets: number | null;
  minimumReps: number | null;
  maximumReps: number | null;
  setChoice: string | null;
  intensityPercent: number | null;
  trainingMax: number | null;
  roundingIncrement: number | null;
};

export type ProgrammePrescriptionSet = {
  reps: string;
  weight: string;
  rpe: string;
  completed: boolean;
};

function selectedValue(minimum: number | null, maximum: number | null, choice: string | null) {
  if (choice === "maximum") return maximum ?? minimum;
  return minimum ?? maximum;
}

function roundToIncrement(value: number, increment: number) {
  const rounded = Math.round(value / increment) * increment;
  return String(Number(rounded.toFixed(4)));
}

function buildPercentageStrengthSets(
  input: ProgrammePrescriptionInput,
): ProgrammePrescriptionSet[] {
  const sets = selectedValue(input.minimumSets, input.maximumSets, input.setChoice);
  const reps = selectedValue(input.minimumReps, input.maximumReps, "minimum");
  if (
    sets == null ||
    sets < 1 ||
    reps == null ||
    reps < 1 ||
    input.intensityPercent == null ||
    input.trainingMax == null ||
    input.trainingMax <= 0
  ) {
    return [];
  }
  const increment =
    input.roundingIncrement && input.roundingIncrement > 0 ? input.roundingIncrement : 2.5;
  const weight = roundToIncrement(input.trainingMax * (input.intensityPercent / 100), increment);
  return Array.from({ length: sets }, () => ({
    reps: String(reps),
    weight,
    rpe: "",
    completed: true,
  }));
}

// Assignment setup is dispatched by programs.method_type. New methodologies can reuse the
// programme/assignment lifecycle and add only the fields and renderer they need here.
const PROGRAMME_METHOD_SETUPS: Record<string, ProgrammeMethodSetup> = {
  percentage_strength: {
    label: "Percentage strength",
    workoutType: "Strength",
    trainingMax: {
      required: true,
      label: "Training max",
      unit: "kg",
      minimum: 0.5,
      step: 0.5,
    },
    buildSetRows: buildPercentageStrengthSets,
  },
};

export function getProgrammeMethodSetup(methodType: string | null) {
  return methodType ? (PROGRAMME_METHOD_SETUPS[methodType] ?? null) : null;
}
