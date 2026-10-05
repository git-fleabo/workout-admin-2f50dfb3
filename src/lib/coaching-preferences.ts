import type { MobilityRun } from "./mobility-practice.ts";
import { MOBILITY_SKILLS } from "./mobility-practice.ts";
import type { GoalRow } from "./training-types.ts";

export type CoachingPreferences = {
  primaryFocusId: string;
  secondaryFocusIds: string[];
  maintenanceFocusIds: string[];
  weeklyTrainingDays: number;
  weeklyMinutes: number;
  maxDemandingDays: number;
  saved: boolean;
};

export type CoachingFocusOption = {
  id: string;
  label: string;
  description: string;
};

export const DEFAULT_COACHING_PREFERENCES: CoachingPreferences = {
  primaryFocusId: "programme",
  secondaryFocusIds: [],
  maintenanceFocusIds: [],
  weeklyTrainingDays: 4,
  weeklyMinutes: 300,
  maxDemandingDays: 3,
  saved: false,
};

export function buildCoachingFocusOptions(goals: GoalRow[], mobilityRuns: MobilityRun[]) {
  const options: CoachingFocusOption[] = [
    {
      id: "programme",
      label: "Current strength programme",
      description: "Progress the programme you are currently running.",
    },
  ];
  for (const goal of goals.filter((item) => item.status === "active")) {
    options.push({
      id: `goal:${goal.id}`,
      label: goal.goal,
      description: "Active goal",
    });
  }
  for (const run of mobilityRuns.filter((item) => item.status === "active")) {
    options.push({
      id: `mobility:${run.id}`,
      label: MOBILITY_SKILLS[run.skill].label,
      description: "Active mobility practice",
    });
  }
  return options;
}

export function normaliseCoachingPreferences(
  value: CoachingPreferences,
  availableFocusIds?: ReadonlySet<string>,
): CoachingPreferences {
  const requestedPrimaryFocusId = value.primaryFocusId.trim() || "programme";
  const primaryFocusId =
    availableFocusIds && !availableFocusIds.has(requestedPrimaryFocusId)
      ? "programme"
      : requestedPrimaryFocusId;
  const valid = (id: string) => id.length > 0 && (!availableFocusIds || availableFocusIds.has(id));
  const secondaryFocusIds = Array.from(new Set(value.secondaryFocusIds))
    .filter((id) => id !== primaryFocusId && valid(id))
    .slice(0, 2);
  const secondarySet = new Set(secondaryFocusIds);
  const maintenanceFocusIds = Array.from(new Set(value.maintenanceFocusIds)).filter(
    (id) => id !== primaryFocusId && !secondarySet.has(id) && valid(id),
  );
  const weeklyTrainingDays = Math.min(7, Math.max(1, Math.round(value.weeklyTrainingDays)));
  return {
    primaryFocusId,
    secondaryFocusIds,
    maintenanceFocusIds,
    weeklyTrainingDays,
    weeklyMinutes: Math.min(1680, Math.max(30, Math.round(value.weeklyMinutes))),
    maxDemandingDays: Math.min(weeklyTrainingDays, Math.max(1, Math.round(value.maxDemandingDays))),
    saved: value.saved,
  };
}
