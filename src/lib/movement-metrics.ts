export type MetricProfile =
  | "weighted"
  | "reps"
  | "carry"
  | "hold"
  | "grip"
  | "mobility_position"
  | "time"
  | "duration"
  | "conditioning"
  | "climbing"
  | "power";

export const TRACKING_MODE_OPTIONS = [
  { value: "weight_reps", label: "Weight + reps", profile: "weighted" },
  { value: "reps_only", label: "Reps only", profile: "reps" },
  { value: "hold", label: "Hold / isometric", profile: "hold" },
  { value: "grip_hold", label: "Grip / loaded hold", profile: "grip" },
  { value: "distance_time", label: "Distance + time", profile: "time" },
  { value: "duration", label: "Duration only", profile: "duration" },
  { value: "conditioning", label: "Rounds / conditioning", profile: "conditioning" },
  { value: "carry", label: "Loaded carry", profile: "carry" },
  { value: "mobility_position", label: "Mobility position", profile: "mobility_position" },
  { value: "power", label: "Power / jumps", profile: "power" },
  { value: "climbing", label: "Climbing", profile: "climbing" },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  profile: MetricProfile;
}>;

export type TrackingMode = (typeof TRACKING_MODE_OPTIONS)[number]["value"];

export type MovementMetricContext = {
  workoutType: string;
  movement: string;
  defaultMetric?: string;
};

const PROFILE_BY_TRACKING_MODE = new Map<TrackingMode, MetricProfile>(
  TRACKING_MODE_OPTIONS.map((option) => [option.value, option.profile]),
);
const TRACKING_MODE_BY_PROFILE = new Map<MetricProfile, TrackingMode>(
  TRACKING_MODE_OPTIONS.map((option) => [option.profile, option.value]),
);

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

  const selectedProfile = PROFILE_BY_TRACKING_MODE.get(metric as TrackingMode);
  if (selectedProfile) return selectedProfile;

  if (
    type === "climbing" ||
    metric.includes("boulder") ||
    metric.includes("route") ||
    metric.includes("grade")
  ) {
    return "climbing";
  }
  if (type === "power" || name === "box jumps" || metric.includes("height")) return "power";
  if (WEIGHTED_EXCEPTIONS.has(name)) return "weighted";
  if (CARRIES.has(name)) return "carry";
  if (metric.includes("distance / hold") || MOBILITY_POSITIONS.has(name)) {
    return "mobility_position";
  }
  if (type === "grip" && (GRIP_HOLDS.has(name) || metric.includes("hold"))) return "grip";
  if (HOLDS.has(name) || metric.includes("hold")) return "hold";
  if ((metric.includes("load") || metric.includes("weight")) && metric.includes("rep")) {
    return "weighted";
  }
  if (metric === "reps" || metric === "rep") return "reps";
  if (metric.includes("round")) return "conditioning";
  if (metric.includes("distance") && metric.includes("time")) return "time";
  if (metric.includes("minute") || metric === "duration" || metric === "time") {
    return type === "conditioning" ? "conditioning" : "duration";
  }
  if (BODYWEIGHT_REPS.has(name)) return "reps";
  if (type === "skills/calisthenics") return "reps";
  if (type === "class" || type === "yoga" || type === "mobility/flexibility") return "duration";
  if (type === "cardio" || type === "run") return "time";
  if (TIME_MOVEMENTS.has(name)) return "duration";
  if (type === "conditioning") return "conditioning";
  return "weighted";
}

export function getTrackingModeValue(context: MovementMetricContext): TrackingMode {
  return TRACKING_MODE_BY_PROFILE.get(getMovementMetricProfile(context)) ?? "weight_reps";
}

export function getTrackingModeLabel(context: MovementMetricContext) {
  const value = getTrackingModeValue(context);
  return TRACKING_MODE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function profileUsesStandardSets(profile: MetricProfile) {
  return profile === "weighted" || profile === "reps";
}

export function profileUsesLoad(profile: MetricProfile) {
  return ["weighted", "carry", "grip", "conditioning"].includes(profile);
}

export function profileSupportsAdvancedMethods(profile: MetricProfile) {
  return ["weighted", "reps", "hold", "grip", "carry", "conditioning", "power"].includes(profile);
}
