import type { ProgrammeTemplateWorkout } from "./supabase-programmes.browser";

export type ProgrammeWeekOverview = {
  week: number;
  completed: number;
  total: number;
  workouts: ProgrammeTemplateWorkout[];
  status: "done" | "current" | "upcoming";
};

export function buildProgrammeWeekOverview(
  workouts: ProgrammeTemplateWorkout[],
  completedCount: number,
  sessionsPerWeek: number | null,
): ProgrammeWeekOverview[] {
  const sorted = [...workouts].sort((left, right) => left.sequenceIndex - right.sequenceIndex);
  const completed = Math.max(0, Math.min(completedCount, sorted.length));
  const groups = new Map<number, ProgrammeTemplateWorkout[]>();
  sorted.forEach((workout, index) => {
    const week = workout.weekNumber ?? Math.floor(index / Math.max(1, sessionsPerWeek ?? 1)) + 1;
    groups.set(week, [...(groups.get(week) ?? []), workout]);
  });
  return [...groups.entries()].map(([week, group]) => {
    const done = group.filter((workout) => workout.sequenceIndex < completed).length;
    return {
      week,
      completed: done,
      total: group.length,
      workouts: group,
      status:
        done === group.length
          ? "done"
          : done > 0 || group[0].sequenceIndex === completed
            ? "current"
            : "upcoming",
    };
  });
}
