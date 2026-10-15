import { getSupabaseSession } from "./supabase-public";
import { readWeeklyPlanAdjustments } from "./weekly-plan";

export function weeklyAdjustmentsStorageKey(startDate: string) {
  const userId = getSupabaseSession()?.user.id ?? "signed-out";
  return `weekly-plan-adjustments:${userId}:${startDate}`;
}

export function readSavedWeeklyAdjustments(startDate: string) {
  return readWeeklyPlanAdjustments(
    window.localStorage.getItem(weeklyAdjustmentsStorageKey(startDate)),
  );
}
