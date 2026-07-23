import type {
  CircuitDifficulty,
  CircuitDoseMode,
  CircuitImpact,
  CircuitMetadata,
  CircuitMovementPattern,
} from "./circuit-metadata";
import { getTrackingModeValue } from "./movement-metrics";
import type { PlannerLocation, PlannerReadiness, WorkoutPlanMovement } from "./workout-plan";

export const CIRCUIT_FOCUS_OPTIONS = [
  { value: "balanced", label: "Balanced", detail: "A varied full-body mix" },
  { value: "upper", label: "Upper body", detail: "Push, pull and grip" },
  { value: "lower", label: "Lower body", detail: "Squat, hinge and lunge" },
  { value: "core", label: "Core", detail: "Trunk, carries and control" },
  { value: "conditioning", label: "Conditioning", detail: "Locomotion, power and full body" },
  { value: "mobility", label: "Mobility", detail: "Mobility, control and skills" },
] as const;

export type CircuitFocus = (typeof CIRCUIT_FOCUS_OPTIONS)[number]["value"];

export const CIRCUIT_INTENSITY_OPTIONS = [
  { value: "gentle", label: "Gentle", detail: "Low impact and conservative doses" },
  { value: "moderate", label: "Moderate", detail: "Steady work with balanced recovery" },
  { value: "hard", label: "Hard", detail: "Higher doses and shorter recovery" },
] as const;

export type CircuitIntensity = (typeof CIRCUIT_INTENSITY_OPTIONS)[number]["value"];

export const CIRCUIT_FORMAT_OPTIONS = [
  { value: "mixed", label: "Mixed", detail: "Use each movement's natural dose" },
  { value: "reps", label: "Rep-led", detail: "Reps and measured carries" },
  { value: "time", label: "Time-led", detail: "Timed holds and movement intervals" },
] as const;

export type CircuitFormat = (typeof CIRCUIT_FORMAT_OPTIONS)[number]["value"];

export const CIRCUIT_EQUIPMENT_OPTIONS = [
  { value: "mat", label: "Mat" },
  { value: "kettlebell", label: "Kettlebell" },
  { value: "dumbbell", label: "Dumbbell" },
  { value: "barbell", label: "Barbell" },
  { value: "bar_rings", label: "Bar / rings" },
  { value: "cardio_machine", label: "Bike / rower" },
  { value: "cable_machine", label: "Cable machine" },
  { value: "specialist", label: "Specialist kit" },
] as const;

export type CircuitEquipment = (typeof CIRCUIT_EQUIPMENT_OPTIONS)[number]["value"];

export type CircuitBuilderConfig = {
  durationMinutes: number;
  location: PlannerLocation;
  readiness: PlannerReadiness;
  focus: CircuitFocus;
  intensity: CircuitIntensity;
  format: CircuitFormat;
  equipment: CircuitEquipment[] | null;
  excludeHighImpact: boolean;
  excludeAdvanced: boolean;
  excludedExerciseIds: string[];
};

export type CircuitCandidate = CircuitMetadata & {
  id: string;
  name: string;
  workoutType: string;
  focusArea: string;
  equipment: string;
  equipmentGroups: CircuitEquipment[];
  metric: string;
  locationScope: PlannerLocation | "both";
  availableLocationKinds: Array<PlannerLocation | "other">;
};

export type CircuitSelection = {
  candidate: CircuitCandidate;
  dose: number;
  doseLabel: string;
  estimatedWorkSeconds: number;
  reason: string;
};

export type CircuitBuildSuccess = {
  ok: true;
  title: string;
  basis: string;
  movements: WorkoutPlanMovement[];
  selections: CircuitSelection[];
  rounds: number;
  restBetweenMovementsSeconds: number;
  restBetweenRoundsSeconds: number;
  estimatedMinutes: number;
  requestedMinutes: number;
  eligibleCount: number;
  warnings: string[];
};

export type CircuitBuildFailure = {
  ok: false;
  message: string;
  eligibleCount: number;
};

export type CircuitBuildResult = CircuitBuildSuccess | CircuitBuildFailure;

export type CircuitBuildOptions = {
  requiredExerciseIds?: string[];
  movementCount?: number;
  variation?: number;
};

const FOCUS_PATTERNS: Record<CircuitFocus, CircuitMovementPattern[]> = {
  balanced: [],
  upper: ["push", "pull", "grip", "skill"],
  lower: ["squat", "hinge", "lunge", "power", "locomotion"],
  core: ["core", "carry", "full_body", "skill"],
  conditioning: ["locomotion", "power", "full_body", "carry"],
  mobility: ["mobility", "core", "skill"],
};

const BALANCED_PATTERN_ORDER: CircuitMovementPattern[] = [
  "squat",
  "push",
  "pull",
  "hinge",
  "core",
  "locomotion",
  "carry",
  "mobility",
  "power",
  "full_body",
  "grip",
  "lunge",
  "skill",
  "other",
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteNumber(value: string, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function configSeed(config: CircuitBuilderConfig) {
  return [
    config.durationMinutes,
    config.location,
    config.readiness,
    config.focus,
    config.intensity,
    config.format,
    config.equipment?.slice().sort().join(",") ?? "any",
    config.excludeHighImpact,
    config.excludeAdvanced,
    config.excludedExerciseIds.slice().sort().join(","),
  ].join("|");
}

export function circuitEquipmentFor(equipment: string): CircuitEquipment[] {
  const value = equipment.trim().toLowerCase();
  if (!value || /^(none|no equipment|body ?weight|n\/a|-)$/.test(value)) return [];
  const tags = new Set<CircuitEquipment>();
  if (value.includes("mat")) tags.add("mat");
  if (value.includes("kettlebell")) tags.add("kettlebell");
  if (value.includes("dumbbell")) tags.add("dumbbell");
  if (value.includes("barbell")) tags.add("barbell");
  if (value.includes("ring") || /(^|\W)bar(\W|$)/.test(value)) tags.add("bar_rings");
  if (value.includes("bike") || value.includes("rower")) tags.add("cardio_machine");
  if (value.includes("cable")) tags.add("cable_machine");
  if (
    [
      "hangboard",
      "pinch",
      "sled",
      "trx",
      "parallette",
      "stall",
      "pole",
      "towel",
      "wrist roller",
    ].some((term) => value.includes(term))
  ) {
    tags.add("specialist");
  }
  if (!tags.size) tags.add("specialist");
  return Array.from(tags);
}

function equipmentMatches(candidate: CircuitCandidate, allowed: CircuitEquipment[] | null) {
  if (allowed == null) return true;
  const required = candidate.equipmentGroups;
  if (!required.length) return true;
  return required.every((tag) => allowed.includes(tag));
}

function formatMatches(mode: CircuitFormat, doseMode: CircuitDoseMode) {
  if (mode === "mixed") return true;
  if (mode === "time") return doseMode === "seconds";
  return doseMode === "reps" || doseMode === "metres";
}

function readinessIntensity(config: CircuitBuilderConfig): CircuitIntensity {
  if (config.readiness === "tired") return "gentle";
  if (config.readiness === "fresh" && config.intensity === "hard") return "hard";
  return config.intensity;
}

function difficultyScore(difficulty: CircuitDifficulty, intensity: CircuitIntensity) {
  const ideal: Record<CircuitIntensity, CircuitDifficulty> = {
    gentle: "beginner",
    moderate: "intermediate",
    hard: "advanced",
  };
  return difficulty === ideal[intensity] ? 10 : difficulty === "intermediate" ? 5 : 1;
}

function impactScore(impact: CircuitImpact, intensity: CircuitIntensity) {
  const ideal: Record<CircuitIntensity, CircuitImpact> = {
    gentle: "low",
    moderate: "moderate",
    hard: "high",
  };
  return impact === ideal[intensity] ? 8 : impact === "low" ? 4 : 1;
}

function isEligible(candidate: CircuitCandidate, config: CircuitBuilderConfig) {
  if (candidate.circuitSuitability === "excluded") return false;
  if (candidate.locationScope !== "both" && candidate.locationScope !== config.location) {
    return false;
  }
  if (!candidate.availableLocationKinds.includes(config.location)) return false;
  if (config.excludedExerciseIds.includes(candidate.id)) return false;
  if (!equipmentMatches(candidate, config.equipment)) return false;
  if (!formatMatches(config.format, candidate.circuitDoseMode)) return false;
  const effectiveIntensity = readinessIntensity(config);
  if (
    (config.excludeAdvanced || effectiveIntensity === "gentle") &&
    candidate.circuitDifficulty === "advanced"
  ) {
    return false;
  }
  if (
    (config.excludeHighImpact || effectiveIntensity !== "hard") &&
    candidate.circuitImpact === "high"
  ) {
    return false;
  }
  return true;
}

function focusMatch(pattern: CircuitMovementPattern, focus: CircuitFocus) {
  return focus === "balanced" || FOCUS_PATTERNS[focus].includes(pattern);
}

function selectionScore(
  candidate: CircuitCandidate,
  config: CircuitBuilderConfig,
  selected: CircuitCandidate[],
  selectionIndex: number,
  variation = 0,
) {
  const effectiveIntensity = readinessIntensity(config);
  const samePatternCount = selected.filter(
    (movement) => movement.circuitPattern === candidate.circuitPattern,
  ).length;
  const desiredPattern =
    config.focus === "balanced"
      ? BALANCED_PATTERN_ORDER[selectionIndex % BALANCED_PATTERN_ORDER.length]
      : FOCUS_PATTERNS[config.focus][selectionIndex % FOCUS_PATTERNS[config.focus].length];
  const suitability = candidate.circuitSuitability === "preferred" ? 28 : 12;
  const focus = focusMatch(candidate.circuitPattern, config.focus) ? 26 : 0;
  const balance = candidate.circuitPattern === desiredPattern ? 18 : 0;
  const diversityPenalty = samePatternCount * 35;
  const stableTieBreak = stableHash(`${configSeed(config)}|${variation}|${candidate.id}`) % 10;
  return (
    suitability +
    focus +
    balance +
    difficultyScore(candidate.circuitDifficulty, effectiveIntensity) +
    impactScore(candidate.circuitImpact, effectiveIntensity) -
    diversityPenalty +
    stableTieBreak
  );
}

function doseFor(candidate: CircuitCandidate, intensity: CircuitIntensity) {
  const minimum = Math.max(1, finiteNumber(candidate.circuitDoseMin, 1));
  const maximum = Math.max(minimum, finiteNumber(candidate.circuitDoseMax, minimum));
  if (intensity === "gentle") return Math.round(minimum);
  if (intensity === "hard") return Math.round(maximum);
  return Math.round((minimum + maximum) / 2);
}

function estimatedWorkSeconds(candidate: CircuitCandidate, dose: number) {
  const perSideMultiplier = candidate.circuitDosePerSide ? 2 : 1;
  if (candidate.circuitDoseMode === "seconds") return dose * perSideMultiplier;
  if (candidate.circuitDoseMode === "metres") return dose * 1.1;
  if (candidate.circuitDoseMode === "rounds") return dose * 30;
  return dose * 2.5 * perSideMultiplier;
}

function doseLabel(candidate: CircuitCandidate, dose: number) {
  const suffix: Record<CircuitDoseMode, string> = {
    reps: "reps",
    seconds: "sec",
    metres: "m",
    rounds: "rounds",
  };
  return `${dose} ${suffix[candidate.circuitDoseMode]}${candidate.circuitDosePerSide ? " / side" : ""}`;
}

function selectionReason(candidate: CircuitCandidate, config: CircuitBuilderConfig, dose: string) {
  const reasons = [
    candidate.circuitSuitability === "preferred" ? "preferred circuit movement" : null,
    focusMatch(candidate.circuitPattern, config.focus)
      ? `${candidate.circuitPattern.replace("_", " ")} pattern fits ${config.focus.replace("_", " ")} focus`
      : "adds movement balance",
    candidate.circuitImpact === "low" ? "low impact" : `${candidate.circuitImpact} impact`,
  ].filter(Boolean);
  return `Generated target: ${dose}. Selected as a ${reasons.join(", ")}.`;
}

function movementFromSelection(selection: CircuitSelection): WorkoutPlanMovement {
  const candidate = selection.candidate;
  const reps = candidate.circuitDoseMode === "reps" ? String(selection.dose) : "";
  const durationSeconds = candidate.circuitDoseMode === "seconds" ? String(selection.dose) : "";
  return {
    exercise: candidate.name,
    workoutType: candidate.workoutType || "Other",
    trackingMode: getTrackingModeValue({
      workoutType: candidate.workoutType || "Other",
      movement: candidate.name,
      defaultMetric: candidate.metric,
    }),
    targets: {
      durationMinutes: "",
      distance: candidate.circuitDoseMode === "metres" ? String(selection.dose) : "",
      distanceUnit: candidate.circuitDoseMode === "metres" ? "m" : "",
      rounds: candidate.circuitDoseMode === "rounds" ? String(selection.dose) : "",
      height: "",
      detail: candidate.circuitDosePerSide ? "Complete the target on each side." : "",
    },
    sourceDate: "",
    reason: selection.reason,
    setRows: [
      {
        reps,
        weight: "",
        durationSeconds,
        rpe: "",
        completed: true,
      },
    ],
  };
}

function targetMovementCount(durationMinutes: number) {
  return clamp(Math.round(durationMinutes / 5) + 1, 3, 8);
}

function chooseRounds(
  targetSeconds: number,
  roundWorkSeconds: number,
  restBetweenRoundsSeconds: number,
) {
  let best = { rounds: 2, total: roundWorkSeconds * 2 + restBetweenRoundsSeconds };
  for (let rounds = 2; rounds <= 8; rounds += 1) {
    const total = roundWorkSeconds * rounds + restBetweenRoundsSeconds * (rounds - 1);
    if (Math.abs(total - targetSeconds) < Math.abs(best.total - targetSeconds)) {
      best = { rounds, total };
    }
  }
  return best;
}

export function buildCircuit(
  candidates: CircuitCandidate[],
  config: CircuitBuilderConfig,
  options: CircuitBuildOptions = {},
): CircuitBuildResult {
  const durationMinutes = clamp(Math.round(config.durationMinutes), 10, 45);
  const normalizedConfig = { ...config, durationMinutes };
  const eligible = candidates.filter((candidate) => isEligible(candidate, normalizedConfig));
  if (eligible.length < 3) {
    return {
      ok: false,
      eligibleCount: eligible.length,
      message:
        "Fewer than three movements match these choices. Allow more equipment, use Mixed format, or relax an exclusion.",
    };
  }

  const requestedCount =
    options.movementCount == null
      ? targetMovementCount(durationMinutes)
      : clamp(Math.round(options.movementCount), 3, 8);
  const movementCount = Math.min(requestedCount, eligible.length);
  const eligibleById = new Map(eligible.map((candidate) => [candidate.id, candidate]));
  const selected = (options.requiredExerciseIds ?? [])
    .map((id) => eligibleById.get(id))
    .filter((candidate): candidate is CircuitCandidate => Boolean(candidate))
    .filter((candidate, index, all) => all.findIndex((item) => item.id === candidate.id) === index)
    .slice(0, movementCount);
  while (selected.length < movementCount) {
    const next = eligible
      .filter((candidate) => !selected.some((movement) => movement.id === candidate.id))
      .sort((left, right) => {
        const difference =
          selectionScore(
            right,
            normalizedConfig,
            selected,
            selected.length,
            options.variation ?? 0,
          ) -
          selectionScore(left, normalizedConfig, selected, selected.length, options.variation ?? 0);
        return difference || left.name.localeCompare(right.name);
      })[0];
    if (!next) break;
    selected.push(next);
  }

  const effectiveIntensity = readinessIntensity(normalizedConfig);
  const selections = selected.map<CircuitSelection>((candidate) => {
    const dose = doseFor(candidate, effectiveIntensity);
    const label = doseLabel(candidate, dose);
    return {
      candidate,
      dose,
      doseLabel: label,
      estimatedWorkSeconds: estimatedWorkSeconds(candidate, dose),
      reason: selectionReason(candidate, normalizedConfig, label),
    };
  });
  const restBetweenMovementsSeconds =
    effectiveIntensity === "gentle" ? 20 : effectiveIntensity === "hard" ? 10 : 15;
  const restBetweenRoundsSeconds =
    effectiveIntensity === "gentle" ? 75 : effectiveIntensity === "hard" ? 45 : 60;
  const roundWorkSeconds =
    selections.reduce((total, selection) => total + selection.estimatedWorkSeconds, 0) +
    restBetweenMovementsSeconds * Math.max(0, selections.length - 1);
  const budget = chooseRounds(durationMinutes * 60, roundWorkSeconds, restBetweenRoundsSeconds);
  const estimatedMinutes = Math.max(1, Math.round(budget.total / 60));
  const warnings = [
    movementCount < requestedCount
      ? `Used ${movementCount} movements because only ${eligible.length} matched every filter.`
      : null,
    Math.abs(estimatedMinutes - durationMinutes) > Math.max(3, durationMinutes * 0.2)
      ? `Estimated at ${estimatedMinutes} minutes; actual pace and transitions will change this.`
      : null,
  ].filter((warning): warning is string => Boolean(warning));
  const focusLabel =
    CIRCUIT_FOCUS_OPTIONS.find((option) => option.value === normalizedConfig.focus)?.label ??
    normalizedConfig.focus;

  return {
    ok: true,
    title: `${durationMinutes}-minute ${focusLabel.toLowerCase()} circuit`,
    basis: `Built deterministically from ${eligible.length} eligible ${normalizedConfig.location} movements. ${movementCount} movements × ${budget.rounds} rounds, with ${restBetweenMovementsSeconds}s transitions and ${restBetweenRoundsSeconds}s between rounds. Estimated ${estimatedMinutes} minutes.`,
    movements: selections.map(movementFromSelection),
    selections,
    rounds: budget.rounds,
    restBetweenMovementsSeconds,
    restBetweenRoundsSeconds,
    estimatedMinutes,
    requestedMinutes: durationMinutes,
    eligibleCount: eligible.length,
    warnings,
  };
}

export function getCircuitReplacementCandidates(
  candidates: CircuitCandidate[],
  config: CircuitBuilderConfig,
  selectedExerciseIds: string[],
  replacementIndex: number,
) {
  const durationMinutes = clamp(Math.round(config.durationMinutes), 10, 45);
  const normalizedConfig = { ...config, durationMinutes };
  const occupiedIds = new Set(selectedExerciseIds);
  const selected = selectedExerciseIds
    .filter((_, index) => index !== replacementIndex)
    .map((id) => candidates.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is CircuitCandidate => Boolean(candidate));

  return candidates
    .filter((candidate) => isEligible(candidate, normalizedConfig))
    .filter((candidate) => !occupiedIds.has(candidate.id))
    .sort((left, right) => {
      const difference =
        selectionScore(right, normalizedConfig, selected, replacementIndex) -
        selectionScore(left, normalizedConfig, selected, replacementIndex);
      return difference || left.name.localeCompare(right.name);
    });
}
