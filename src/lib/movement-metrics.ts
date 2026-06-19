export type MetricProfile =
  | "weighted"
  | "reps"
  | "carry"
  | "hold"
  | "grip"
  | "mobility_position"
  | "time"
  | "conditioning"
  | "climbing"
  | "power";

export type MovementMetricContext = {
  workoutType: string;
  movement: string;
  defaultMetric?: string;
};

const MOBILITY_POSITIONS = new Set([
  "front split",
  "side split",
  "pancake",
  "pike",
  "bridge",
  "shoulder flexion",
]);

const CARRIES = new Set(["farmer carry", "suitcase carry"]);
const WEIGHTED_EXCEPTIONS = new Set(["atg squats"]);
const BODYWEIGHT_REPS = new Set([
  "muscle-up",
  "bar muscle-up",
  "ring muscle-up",
  "handstand pushups",
  "pistol squats",
  "pushups",
  "1-arm pushups",
]);
const HOLDS = new Set([
  "plank",
  "front lever",
  "back lever",
  "handstand",
  "human flag",
  "l-sit",
  "planche",
]);
const GRIP_HOLDS = new Set([
  "dead hang",
  "fat grip hang",
  "hangboard",
  "pinch block",
  "towel hang",
  "wrist roller",
  "other",
]);
const TIME_MOVEMENTS = new Set([
  "jog",
  "run",
  "bike",
  "row",
  "sprint",
  "run / bike / row",
  "intervals",
  "yoga flow",
  "stretch session",
  "mobility circuit",
  "yoga class",
  "pilates class",
  "strength class",
  "conditioning class",
  "other session",
]);

export function getMovementMetricProfile({
  workoutType,
  movement,
  defaultMetric = "",
}: MovementMetricContext): MetricProfile {
  const type = workoutType.trim().toLowerCase();
  const name = movement.trim().toLowerCase();
  const metric = defaultMetric.trim().toLowerCase();

  if (type === "climbing") return "climbing";
  if (type === "power" || name === "box jumps") return "power";
  if (WEIGHTED_EXCEPTIONS.has(name)) return "weighted";
  if (BODYWEIGHT_REPS.has(name)) return "reps";
  if (MOBILITY_POSITIONS.has(name)) return "mobility_position";
  if (CARRIES.has(name)) return "carry";
  if (type === "grip" && GRIP_HOLDS.has(name)) return "grip";
  if (HOLDS.has(name) || metric.includes("hold")) return "hold";
  if (type === "skills/calisthenics") return "reps";
  if (type === "cardio" || type === "run" || type === "class") return "time";
  if (TIME_MOVEMENTS.has(name)) return "time";
  if (type === "conditioning" || metric.includes("round") || metric.includes("minute")) {
    return "conditioning";
  }
  return "weighted";
}

export function profileUsesStandardSets(profile: MetricProfile) {
  return profile === "weighted" || profile === "reps" || profile === "power";
}

export function profileUsesLoad(profile: MetricProfile) {
  return ["weighted", "carry", "grip", "conditioning"].includes(profile);
}
