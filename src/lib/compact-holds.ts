import type { WorkoutPlanMovement, WorkoutPlanSet } from "./workout-plan.ts";
import { isStrengthLogState, type StrengthLogState } from "./compact-strength.ts";
import type { LoadSemantics } from "./data-quality.ts";

export type HoldLogState = Pick<StrengthLogState, "prescribed" | "plannedRows" | "confirmed">;

export function createHoldLog(
  movement: WorkoutPlanMovement,
  sessionOrTimedWork = false,
): HoldLogState | undefined {
  if (
    sessionOrTimedWork ||
    !["hold", "grip_hold"].includes(movement.trackingMode) ||
    !movement.setRows.length ||
    movement.setRows.some((row) => row.method || row.reps)
  )
    return undefined;
  return { prescribed: true, plannedRows: structuredClone(movement.setRows), confirmed: false };
}

export const isHoldLogState = (value: unknown): value is HoldLogState => isStrengthLogState(value);

export function canShareHoldTime(rows: WorkoutPlanSet[]) {
  return (
    rows.length > 0 &&
    !rows.some((row) => row.method || row.reps) &&
    rows.every((row) => row.durationSeconds === rows[0].durationSeconds)
  );
}

export function applySharedHoldTime<T extends WorkoutPlanSet>(
  rows: T[],
  durationSeconds: string,
): T[] {
  return canShareHoldTime(rows) ? rows.map((row) => ({ ...row, durationSeconds })) : rows;
}

export function holdRowsReady(rows: WorkoutPlanSet[]) {
  return (
    rows.some((row) => row.completed !== false) &&
    rows.every(
      (row) =>
        row.completed === false ||
        (row.durationSeconds.trim() !== "" &&
          Number.isFinite(Number(row.durationSeconds)) &&
          Number(row.durationSeconds) > 0 &&
          Number(row.durationSeconds) <= 86400 &&
          (row.weight.trim() === "" ||
            (Number.isFinite(Number(row.weight)) &&
              Number(row.weight) >= 0 &&
              Number(row.weight) <= 1000))),
    )
  );
}

export function holdMatchesPrescription(rows: WorkoutPlanSet[], planned: WorkoutPlanSet[]) {
  return (
    rows.length === planned.length &&
    rows.every(
      (row, index) =>
        row.durationSeconds === planned[index].durationSeconds &&
        row.weight === planned[index].weight &&
        row.completed !== false &&
        !row.method,
    )
  );
}

export function holdSummary(rows: WorkoutPlanSet[]) {
  const completed = rows.filter((row) => row.completed !== false);
  const seconds = completed.reduce((sum, row) => sum + (Number(row.durationSeconds) || 0), 0);
  const sameTime =
    rows.length > 0 && rows.every((row) => row.durationSeconds === rows[0].durationSeconds);
  const sameWeight = rows.length > 0 && rows.every((row) => row.weight === rows[0].weight);
  const times =
    sameTime && rows[0].durationSeconds
      ? `${rows.length} × ${rows[0].durationSeconds} sec`
      : `${rows.length} attempts · ${rows.map((row) => row.durationSeconds || "—").join(" / ")} sec`;
  const weight =
    sameWeight && Number(rows[0]?.weight) > 0
      ? ` at ${rows[0].weight} kg`
      : !sameWeight
        ? " · different loads"
        : "";
  return `${times}${weight}${seconds > 0 ? ` · ${seconds} sec total` : ""}${completed.length !== rows.length ? ` · ${completed.length} completed` : ""}`;
}

export function gripLoadSemantics(value: string): LoadSemantics | "" {
  if (value === "Added weight") return "added_bodyweight_load";
  if (value === "Assistance/counterweight") return "assistance";
  if (value === "Implement weight") return "total_external_load";
  if (value === "Bodyweight") return "none";
  return "";
}

export function gripLoadIssue(rows: WorkoutPlanSet[], loadType: string): string | null {
  if (!rows.some((row) => row.completed !== false && Number(row.weight) > 0)) return null;
  if (loadType === "Bodyweight") return "For bodyweight holds, leave the load blank or zero.";
  return gripLoadSemantics(loadType)
    ? null
    : "Choose the load type for the grip weight you recorded.";
}
