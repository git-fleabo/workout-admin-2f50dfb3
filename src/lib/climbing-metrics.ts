export const CLIMBING_TRACKING_MODES = ["Time only", "Problems / routes"] as const;
export const MAX_CLIMBING_MINUTES = 720;

type ClimbingMetricInput = {
  minutes: string;
  trackingMode?: string;
  problemsOrRoutes?: string;
};

function positiveInteger(value: string) {
  if (!/^\d+$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function climbingMetricIssue({
  minutes,
  trackingMode,
  problemsOrRoutes,
}: ClimbingMetricInput) {
  const duration = positiveInteger(minutes);
  if (duration == null) return "Enter the total climbing time as a whole number of minutes.";
  if (duration > MAX_CLIMBING_MINUTES) {
    return `Climbing time cannot exceed ${MAX_CLIMBING_MINUTES} minutes. For 1h 15m, enter 75.`;
  }
  if (!CLIMBING_TRACKING_MODES.includes(trackingMode as (typeof CLIMBING_TRACKING_MODES)[number])) {
    return "Choose whether to track time only or problems / routes.";
  }
  if (trackingMode === "Problems / routes" && positiveInteger(problemsOrRoutes ?? "") == null) {
    return "Enter the number of problems or routes completed.";
  }
  return null;
}

export function supportsClimbingGradient(movement: string) {
  return movement.trim().toLowerCase() === "kilter";
}
