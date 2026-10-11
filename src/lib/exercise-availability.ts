export type ExerciseLocationScope = "home" | "gym" | "both";
export type TrainingLocationKind = "home" | "gym" | "other";

type ExerciseAvailability = {
  locationScope?: ExerciseLocationScope;
  equipmentItemIds?: readonly string[];
  availableLocationIds?: readonly string[];
  availableLocationKinds?: readonly TrainingLocationKind[];
};

type ExerciseLocation = {
  id: string;
  kind: TrainingLocationKind;
  name?: string;
  equipmentItemIds?: readonly string[];
};

export function exerciseScopeAllowsLocation(
  scope: ExerciseLocationScope | undefined,
  kind: TrainingLocationKind,
) {
  return kind === "other" || !scope || scope === "both" || scope === kind;
}

export function exerciseLocationAvailability(
  exercise: ExerciseAvailability,
  location: ExerciseLocation,
) {
  const scopeBlocked = !exerciseScopeAllowsLocation(exercise.locationScope, location.kind);
  const availableEquipment = new Set(location.equipmentItemIds ?? []);
  const missingEquipmentIds = (exercise.equipmentItemIds ?? []).filter(
    (id) => !availableEquipment.has(id),
  );
  return {
    scopeBlocked,
    missingEquipmentIds,
    available:
      !scopeBlocked &&
      missingEquipmentIds.length === 0 &&
      (!exercise.availableLocationIds || exercise.availableLocationIds.includes(location.id)),
  };
}

export function exerciseIsAvailableAtKind(
  exercise: ExerciseAvailability,
  kind: TrainingLocationKind,
) {
  return (
    exerciseScopeAllowsLocation(exercise.locationScope, kind) &&
    (!exercise.availableLocationKinds || exercise.availableLocationKinds.includes(kind))
  );
}

export function exerciseUnavailableReason(
  exercise: ExerciseAvailability | undefined,
  location: ExerciseLocation | undefined,
  equipment: readonly { id: string; name: string }[] = [],
) {
  if (!exercise) return "This movement is no longer enabled in your Library.";
  if (!location) return "Choose an active training location.";
  const availability = exerciseLocationAvailability(exercise, location);
  const reasons: string[] = [];
  if (availability.scopeBlocked) {
    const scope = exercise.locationScope === "home" ? "Home" : "Gym";
    reasons.push(
      `Set to ${scope} only in Library. Change its training location to Both to use it here.`,
    );
  }
  if (availability.missingEquipmentIds.length) {
    const names = availability.missingEquipmentIds.map(
      (id) => equipment.find((item) => item.id === id)?.name ?? "an unlisted equipment item",
    );
    reasons.push(`Missing equipment at ${location.name ?? "this location"}: ${names.join(", ")}.`);
  }
  return reasons.join(" ") || "This movement is unavailable here. Check its Library settings.";
}
