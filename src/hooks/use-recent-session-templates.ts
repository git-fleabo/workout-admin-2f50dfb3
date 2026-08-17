import { useMemo } from "react";

import type { RecentSessionTemplate } from "@/components/workout-logger/full-workout-form";
import type { RecentWorkoutLog } from "@/lib/workout-plan";

type UseRecentSessionTemplatesOptions = {
  logs: RecentWorkoutLog[];
  locationKind?: string;
  allowedExerciseNames: Set<string>;
  buildTemplates: (
    logs: RecentWorkoutLog[],
    locationKind?: string,
    allowedExerciseNames?: Set<string>,
  ) => RecentSessionTemplate[];
};

export function useRecentSessionTemplates({
  logs,
  locationKind,
  allowedExerciseNames,
  buildTemplates,
}: UseRecentSessionTemplatesOptions) {
  const recentExerciseNames = useMemo(() => {
    const completed = logs.filter((item) => item.completed && item.exercise);
    const locationMatches = locationKind
      ? completed.filter((item) => item.trainingLocation?.kind === locationKind)
      : completed;
    const source = locationMatches.length > 0 ? locationMatches : completed;
    return Array.from(new Set(source.map((item) => item.exercise))).slice(0, 10);
  }, [locationKind, logs]);

  const recentSessionTemplates = useMemo(
    () => buildTemplates(logs, locationKind, allowedExerciseNames),
    [allowedExerciseNames, buildTemplates, locationKind, logs],
  );

  return { recentExerciseNames, recentSessionTemplates };
}
