export type ProgrammeMethodSetup = {
  label: string;
  trainingMax: {
    required: boolean;
    label: string;
    unit: string;
    minimum: number;
    step: number;
  } | null;
};

// Assignment setup is dispatched by programs.method_type. New methodologies can reuse the
// programme/assignment lifecycle and add only the fields and renderer they need here.
const PROGRAMME_METHOD_SETUPS: Record<string, ProgrammeMethodSetup> = {
  percentage_strength: {
    label: "Percentage strength",
    trainingMax: {
      required: true,
      label: "Training max",
      unit: "kg",
      minimum: 0.5,
      step: 0.5,
    },
  },
};

export function getProgrammeMethodSetup(methodType: string | null) {
  return methodType ? (PROGRAMME_METHOD_SETUPS[methodType] ?? null) : null;
}
