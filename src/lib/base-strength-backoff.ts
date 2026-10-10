import { roundedPreviewLoad } from "./base-strength-preview.ts";
import type { WorkoutPlanSet, WorkoutPlanMovement } from "./workout-plan.ts";

export function usesDupBackOff(
  movement: Pick<WorkoutPlanMovement, "baseStrength" | "progression">,
) {
  return (
    movement.baseStrength?.programme === "dup" &&
    movement.baseStrength.phase === "peak" &&
    movement.baseStrength.backOffPercent === 90 &&
    movement.progression?.type === "source"
  );
}

// The first row is the selected top set; round its 90% back-off once.
// Blanking an unresolved top load also blanks every dependent load.
export function dupBackOffRows<T extends Pick<WorkoutPlanSet, "weight">>(
  rows: T[],
  topLoad: string,
  increment: number,
): T[] {
  const load =
    /^\d+(\.\d+)?$/.test(topLoad) && Number(topLoad) <= 1000
      ? roundedPreviewLoad(Number(topLoad), 90, increment)
      : null;
  return rows.map((row, index) => ({
    ...row,
    weight: index === 0 ? topLoad : load == null ? "" : String(load),
  }));
}
