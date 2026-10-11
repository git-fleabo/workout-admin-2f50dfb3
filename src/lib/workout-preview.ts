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
