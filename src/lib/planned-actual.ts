export type PlannedActualSet = {
  setNumber: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  completed: boolean;
};

export type PlannedActualStatus = "met" | "exceeded" | "partial" | "missed";
export type PlannedActualMethodStatus = "none" | "matched" | "changed" | "omitted" | "added";

export type PlannedActualMethod = {
  key: string;
  name: string;
};

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
  plannedMethods: PlannedActualMethod[];
  actualMethods: PlannedActualMethod[];
  methodStatus: PlannedActualMethodStatus;
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
  plannedMethods = [],
  actualMethods = [],
}: Omit<
  PlannedActualComparison,
  "status" | "plannedVolume" | "actualVolume" | "plannedMethods" | "actualMethods" | "methodStatus"
> & {
  plannedMethods?: PlannedActualMethod[];
  actualMethods?: PlannedActualMethod[];
}): PlannedActualComparison {
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
  const uniqueMethods = (methods: PlannedActualMethod[]) =>
    Array.from(new Map(methods.map((method) => [method.key, method])).values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  const plannedMethodList = uniqueMethods(plannedMethods);
  const actualMethodList = uniqueMethods(actualMethods);
  const plannedKeys = plannedMethodList.map((method) => method.key);
  const actualKeys = actualMethodList.map((method) => method.key);
  const sameMethods =
    plannedKeys.length === actualKeys.length &&
    plannedKeys.every((key) => actualKeys.includes(key));
  const methodStatus: PlannedActualMethodStatus =
    plannedKeys.length === 0 && actualKeys.length === 0
      ? "none"
      : plannedKeys.length === 0
        ? "added"
        : actualKeys.length === 0
          ? "omitted"
          : sameMethods
            ? "matched"
            : "changed";

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
    plannedMethods: plannedMethodList,
    actualMethods: actualMethodList,
    methodStatus,
  };
}
