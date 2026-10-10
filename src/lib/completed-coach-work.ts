import type { SavedWorkoutPlan } from "./supabase-plans.browser.ts";
import type { WeeklyPlanDay, WeeklyPlanItemKind } from "./weekly-plan.ts";

// Home/Gym describe a location, not a training domain. When every log behind
// that location is already represented by completed saved work, do not invent
// an extra strength session (or count climbing twice via location and activity).
export function completedItemCoveredBySavedPlans(
  day: WeeklyPlanDay,
  item: WeeklyPlanItemKind,
  plans: SavedWorkoutPlan[],
) {
  const evidence = day.completedEvidence?.filter((entry) => entry.item === item) ?? [];
  return (
    evidence.length > 0 &&
    evidence.every((entry) =>
      plans.some(
        (plan) =>
          plan.status === "completed" &&
          plan.suggestedFor === day.date &&
          plan.completedSessionId === entry.sessionId,
      ),
    )
  );
}
