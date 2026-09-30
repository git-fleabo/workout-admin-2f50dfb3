import type { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  buildMobilityWorkoutDraft,
  type MobilityDrill,
  type MobilityRun,
} from "./mobility-practice";
import type { getLibraryClient } from "./supabase-log.browser";
import {
  WORKOUT_PLAN_DRAFT_KEY,
  WORKOUT_PLAN_LOCATION_KEY,
  WORKOUT_TRAINING_LOCATION_KEY,
} from "./workout-plan";

export function launchMobilityPractice(
  run: MobilityRun,
  drills: MobilityDrill[],
  library: Awaited<ReturnType<typeof getLibraryClient>>,
  navigate: ReturnType<typeof useNavigate>,
) {
  try {
    const locationKind =
      window.localStorage.getItem(WORKOUT_PLAN_LOCATION_KEY) === "home" ? "home" : "gym";
    const draft = buildMobilityWorkoutDraft({
      run,
      drills,
      library: library.exercises,
      locationKind,
      trainingLocationId: window.localStorage.getItem(WORKOUT_TRAINING_LOCATION_KEY) ?? undefined,
    });
    window.localStorage.setItem(WORKOUT_PLAN_DRAFT_KEY, JSON.stringify(draft));
    navigate({ to: "/log" });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not open the practice.");
  }
}
