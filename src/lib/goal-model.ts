import type { GoalMetric, GoalType } from "./training-types";
import type { MetricProfile } from "./movement-metrics";

export type GoalMetricOption = {
  value: GoalMetric;
  label: string;
  unit: string;
};

export const GOAL_TYPE_OPTIONS: Array<{
  value: Exclude<GoalType, "legacy">;
  label: string;
  description: string;
}> = [
  {
    value: "consistency",
    label: "Consistency",
    description: "Repeat an activity a set number of times.",
  },
  {
    value: "performance",
    label: "Performance",
    description: "Reach a measurable result for an exercise.",
  },
  {
    value: "duration",
    label: "Duration",
    description: "Build time or distance in an activity.",
  },
  {
    value: "milestone",
    label: "Milestone",
    description: "Complete a skill or one-off achievement.",
  },
];

const CONSISTENCY_METRICS: GoalMetricOption[] = [
  { value: "sessions", label: "Training sessions", unit: "sessions" },
  { value: "active_days", label: "Active days", unit: "days" },
  { value: "minutes", label: "Active minutes", unit: "minutes" },
  { value: "checkins", label: "Manual check-ins", unit: "check-ins" },
];

const PERFORMANCE_METRICS: Record<MetricProfile, GoalMetricOption[]> = {
  weighted: [
    { value: "max_weight", label: "Top weight", unit: "kg" },
    { value: "estimated_1rm", label: "Estimated 1RM", unit: "kg" },
    { value: "reps", label: "Reps in one set", unit: "reps" },
  ],
  reps: [{ value: "reps", label: "Reps in one set", unit: "reps" }],
  hold: [{ value: "hold_seconds", label: "Longest hold", unit: "seconds" }],
  grip: [
    { value: "hold_seconds", label: "Longest hold", unit: "seconds" },
    { value: "max_weight", label: "Top load", unit: "kg" },
  ],
  time: [
    { value: "distance_km", label: "Distance", unit: "km" },
    { value: "duration_minutes", label: "Duration", unit: "minutes" },
  ],
  duration: [{ value: "duration_minutes", label: "Duration", unit: "minutes" }],
  conditioning: [
    { value: "rounds", label: "Rounds", unit: "rounds" },
    { value: "duration_minutes", label: "Duration", unit: "minutes" },
  ],
  carry: [
    { value: "distance_m", label: "Distance", unit: "metres" },
    { value: "max_weight", label: "Top load", unit: "kg" },
  ],
  mobility_position: [{ value: "hold_seconds", label: "Position hold", unit: "seconds" }],
  power: [{ value: "height_cm", label: "Height", unit: "cm" }],
  climbing: [{ value: "problems", label: "Problems completed", unit: "problems" }],
};

const DURATION_METRICS: Record<MetricProfile, GoalMetricOption[]> = {
  weighted: [{ value: "duration_minutes", label: "Session duration", unit: "minutes" }],
  reps: [{ value: "duration_minutes", label: "Session duration", unit: "minutes" }],
  hold: [{ value: "hold_seconds", label: "Hold duration", unit: "seconds" }],
  grip: [{ value: "hold_seconds", label: "Hold duration", unit: "seconds" }],
  time: [
    { value: "duration_minutes", label: "Duration", unit: "minutes" },
    { value: "distance_km", label: "Distance", unit: "km" },
  ],
  duration: [{ value: "duration_minutes", label: "Duration", unit: "minutes" }],
  conditioning: [{ value: "duration_minutes", label: "Duration", unit: "minutes" }],
  carry: [{ value: "distance_m", label: "Distance", unit: "metres" }],
  mobility_position: [{ value: "hold_seconds", label: "Position hold", unit: "seconds" }],
  power: [{ value: "duration_minutes", label: "Session duration", unit: "minutes" }],
  climbing: [{ value: "duration_minutes", label: "Session duration", unit: "minutes" }],
};

export function getGoalMetricOptions(
  goalType: GoalType,
  profile: MetricProfile,
): GoalMetricOption[] {
  if (goalType === "consistency" || goalType === "legacy") return CONSISTENCY_METRICS;
  if (goalType === "duration") return DURATION_METRICS[profile];
  if (goalType === "milestone") {
    return [{ value: "completed", label: "Completion", unit: "" }];
  }
  return PERFORMANCE_METRICS[profile];
}

export function goalTypeLabel(goalType: GoalType) {
  if (goalType === "legacy") return "General";
  return GOAL_TYPE_OPTIONS.find((option) => option.value === goalType)?.label ?? goalType;
}

export function goalMetricLabel(metric: GoalMetric | "") {
  if (!metric) return "";
  const options = [
    ...CONSISTENCY_METRICS,
    ...Object.values(PERFORMANCE_METRICS).flat(),
    ...Object.values(DURATION_METRICS).flat(),
    { value: "completed" as const, label: "Completion", unit: "" },
  ];
  return options.find((option) => option.value === metric)?.label ?? metric;
}
