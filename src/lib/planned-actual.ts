export type PlannedActualSet = {
  setNumber: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  completed: boolean;
};

export type PlannedActualStatus = "met" | "exceeded" | "partial" | "missed";

export type PlannedActualComparison = {
  id: string;
  planTitle: string;
  sessionId: string;
  date: string;
  locationKind: "home" | "gym" | "other" | null;
  planned: PlannedActualSet[];
  actual: PlannedActualSet[];
  status: PlannedActualStatus;
  plannedVolume: number;
  actualVolume: number;
};

function setTargetMet(planned: PlannedActualSet, actual: PlannedActualSet | undefined) {
  if (!actual?.completed) return false;
  if (planned.weight != null && (actual.weight == null || actual.weight < planned.weight)) {
    return false;
  }
  if (planned.reps != null && (actual.reps == null || actual.reps < planned.reps)) return false;
  return true;
}

function volume(sets: PlannedActualSet[]) {
  return Math.round(
    sets.reduce(
      (total, set) => total + (set.completed ? (set.weight ?? 0) * (set.reps ?? 0) : 0),
      0,
    ),
  );
}

export function comparePlannedActual({
  id,
  planTitle,
  sessionId,
  date,
  locationKind,
  planned,
  actual,
}: Omit<
  PlannedActualComparison,
  "status" | "plannedVolume" | "actualVolume"
>): PlannedActualComparison {
  const completedActual = actual.filter((set) => set.completed);
  const targets = planned.filter((set) => set.completed);
  const allMet =
    targets.length > 0 && targets.every((set, index) => setTargetMet(set, completedActual[index]));
  const exceeded =
    allMet &&
    (completedActual.length > targets.length ||
      targets.some((set, index) => {
        const performed = completedActual[index];
        return Boolean(
          performed &&
          ((set.weight != null && (performed.weight ?? 0) > set.weight) ||
            (set.reps != null && (performed.reps ?? 0) > set.reps)),
        );
      }));
  const status: PlannedActualStatus =
    completedActual.length === 0 ? "missed" : exceeded ? "exceeded" : allMet ? "met" : "partial";

  return {
    id,
    planTitle,
    sessionId,
    date,
    locationKind,
    planned,
    actual,
    status,
    plannedVolume: volume(targets),
    actualVolume: volume(completedActual),
  };
}
