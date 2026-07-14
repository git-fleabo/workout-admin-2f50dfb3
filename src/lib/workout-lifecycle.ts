export type SuggestedWorkoutStatus = "pending" | "accepted" | "completed" | "skipped" | "archived";

export type WorkoutLifecycleState =
  | "planned"
  | "ready"
  | "in_progress"
  | "completed"
  | "skipped"
  | "archived";

export const WORKOUT_LIFECYCLE: Record<
  WorkoutLifecycleState,
  { label: string; description: string }
> = {
  planned: {
    label: "Planned",
    description: "Saved for later and still editable before training.",
  },
  ready: {
    label: "Ready",
    description: "Chosen as the next workout, but not yet being logged.",
  },
  in_progress: {
    label: "In progress",
    description: "An autosaved workout draft exists on this device.",
  },
  completed: {
    label: "Completed",
    description: "Finished and stored in workout history.",
  },
  skipped: {
    label: "Skipped",
    description: "Deliberately not completed.",
  },
  archived: {
    label: "Archived",
    description: "No longer active; superseded or retained for reference.",
  },
};

export function workoutPlanLifecycleState(
  status: SuggestedWorkoutStatus,
  planId?: string,
  activeDraftPlanId?: string | null,
): WorkoutLifecycleState {
  if (planId && activeDraftPlanId === planId && (status === "pending" || status === "accepted")) {
    return "in_progress";
  }
  if (status === "pending") return "planned";
  if (status === "accepted") return "ready";
  return status;
}
