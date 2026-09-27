import type { WorkoutPlanMovement } from "./workout-plan";

export function daysSinceSuggestedSession(scheduledDate: string | null, today: string) {
  if (!scheduledDate) return 0;
  const suggested = Date.parse(`${scheduledDate}T00:00:00Z`);
  const current = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(suggested) || !Number.isFinite(current)) return 0;
  return Math.max(0, Math.floor((current - suggested) / 86_400_000));
}

function lighterNumber(value: string, fraction: number, increment: number) {
  const number = Number(value);
  if (!value.trim() || !Number.isFinite(number) || number <= 0) return value;
  const reduced = Math.max(increment, Math.floor((number * fraction) / increment) * increment);
  return String(reduced);
}

export function easierProgrammeMovements(movements: WorkoutPlanMovement[]) {
  return movements.map((movement) => {
    const hasMultipleSets = movement.setRows.length > 1;
    const rows = hasMultipleSets ? movement.setRows.slice(0, -1) : movement.setRows;
    return {
      ...movement,
      reason: `${movement.reason} Easier return option: start lighter and edit any target before saving.`,
      setRows: rows.map((set) => ({
        ...set,
        weight: lighterNumber(set.weight, 0.9, 0.5),
        reps: hasMultipleSets ? set.reps : lighterNumber(set.reps, 0.8, 1),
        durationSeconds: hasMultipleSets
          ? set.durationSeconds
          : lighterNumber(set.durationSeconds, 0.8, 1),
      })),
    };
  });
}
