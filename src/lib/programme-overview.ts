import type { ProgrammeTemplateWorkout } from "./supabase-programmes.browser";

export type ProgrammeWeekOverview = {
  week: number;
  completed: number;
  skipped: number;
  total: number;
  workouts: ProgrammeTemplateWorkout[];
  status: "done" | "current" | "upcoming";
};

export function buildProgrammeWeekOverview(
  workouts: ProgrammeTemplateWorkout[],
  currentWorkoutIndex: number,
  sessionsPerWeek: number | null,
  skippedWorkoutIds: Set<string> = new Set(),
): ProgrammeWeekOverview[] {
  const sorted = [...workouts].sort((left, right) => left.sequenceIndex - right.sequenceIndex);
  const current = Math.max(0, Math.min(currentWorkoutIndex, sorted.length));
  const groups = new Map<number, ProgrammeTemplateWorkout[]>();
  sorted.forEach((workout, index) => {
    const week = workout.weekNumber ?? Math.floor(index / Math.max(1, sessionsPerWeek ?? 1)) + 1;
    groups.set(week, [...(groups.get(week) ?? []), workout]);
  });
  return [...groups.entries()].map(([week, group]) => {
    const done = group.filter(
      (workout) => workout.sequenceIndex < current && !skippedWorkoutIds.has(workout.id),
    ).length;
    const skipped = group.filter(
      (workout) => workout.sequenceIndex < current && skippedWorkoutIds.has(workout.id),
    ).length;
    return {
      week,
      completed: done,
      skipped,
      total: group.length,
      workouts: group,
      status:
        done + skipped === group.length
          ? "done"
          : done + skipped > 0 || group[0].sequenceIndex === current
            ? "current"
            : "upcoming",
    };
  });
}
