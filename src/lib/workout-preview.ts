import type { WorkoutPlanMovement } from "./workout-plan";

export function compactSequence(names: string[]) {
  for (let size = 1; size <= names.length; size++) {
    if (names.length % size === 0 && names.every((name, index) => name === names[index % size])) {
      return { names: names.slice(0, size), passes: names.length / size };
    }
  }
  return { names: [], passes: 0 };
}

export function groupPreviewMovements(movements: WorkoutPlanMovement[]) {
  const groups = new Map<string, { movement: WorkoutPlanMovement; positions: number[] }>();
  movements.forEach((movement, index) => {
    const key = JSON.stringify(movement);
    const group = groups.get(key) ?? { movement, positions: [] };
    group.positions.push(index + 1);
    groups.set(key, group);
  });
  return [...groups.values()];
}

export function repLabel(reps: string) {
  return `${reps} ${Number(reps) === 1 ? "rep" : "reps"}`;
}

export function previewTarget(movement: WorkoutPlanMovement) {
  return movement.setRows
    .map(
      (set) =>
        `${set.reps ? repLabel(set.reps) : `${set.durationSeconds} sec`}${set.weight ? ` · ${set.weight} kg` : ""}`,
    )
    .join("; ");
}

// Rows retain the original order; a repeated exercise sequence is a layout aid,
// not an instruction to repeat rounds or skip side/timing notes.
export function previewSequenceRows(movements: WorkoutPlanMovement[]) {
  const sequence = compactSequence(movements.map((movement) => movement.exercise));
  const width = sequence.names.length;
  if (sequence.passes < 2 || width > 4) return null;
  return {
    names: sequence.names,
    rows: Array.from({ length: sequence.passes }, (_, index) => ({
      start: index * width + 1,
      end: (index + 1) * width,
      movements: movements.slice(index * width, (index + 1) * width),
    })),
  };
}
