import type { WorkoutPlanSet, WorkoutPlanMovement } from "./workout-plan.ts";

export type StrengthLogState = {
  prescribed: boolean;
  plannedRows: WorkoutPlanSet[];
  confirmed: boolean;
  plusSetIndex?: number;
};

export function createStrengthLog(
  movement: WorkoutPlanMovement,
  sessionOrTimedWork = false,
): StrengthLogState | undefined {
  if (
    sessionOrTimedWork ||
    movement.workoutType !== "Strength" ||
    !["weight_reps", "reps_only"].includes(movement.trackingMode) ||
    !movement.setRows.length ||
    movement.setRows.some((row) => row.method || row.durationSeconds) ||
    (movement.baseStrength?.programme === "dup" && movement.baseStrength.backOffPercent === 90)
  )
    return undefined;
  return {
    prescribed: true,
    plannedRows: structuredClone(movement.setRows),
    confirmed: false,
    ...(movement.baseStrength?.plusLastSet ? { plusSetIndex: movement.setRows.length - 1 } : {}),
  };
}

export function isStrengthLogState(value: unknown): value is StrengthLogState {
  if (!value || typeof value !== "object") return false;
  const log = value as StrengthLogState;
  return (
    typeof log.prescribed === "boolean" &&
    typeof log.confirmed === "boolean" &&
    Array.isArray(log.plannedRows) &&
    log.plannedRows.every(
      (row) => typeof row.reps === "string" && typeof row.weight === "string",
    ) &&
    (log.plusSetIndex == null || (Number.isInteger(log.plusSetIndex) && log.plusSetIndex >= 0))
  );
}

export function strengthSetSummary(rows: WorkoutPlanSet[], usesLoad: boolean) {
  const commonReps = rows.length > 0 && rows.every((row) => row.reps === rows[0].reps);
  const commonLoad = rows.length > 0 && rows.every((row) => row.weight === rows[0].weight);
  const complete = rows.filter((row) => row.completed !== false);
  if (!rows.length) return "Enter your sets and reps";
  const reps =
    commonReps && rows[0].reps
      ? `${rows.length} × ${rows[0].reps}`
      : `${rows.length} sets · ${rows.map((row) => row.reps || "—").join(" / ")} reps`;
  const load = !usesLoad
    ? ""
    : commonLoad && rows[0].weight !== ""
      ? ` at ${rows[0].weight} kg`
      : commonLoad
        ? " · choose weight"
        : " · different loads";
  return `${reps}${load}${complete.length !== rows.length ? ` · ${complete.length} completed` : ""}`;
}

export function canShareStrengthWeight(rows: WorkoutPlanSet[]) {
  return (
    rows.length > 0 &&
    !rows.some((row) => row.method) &&
    rows.every((row) => row.weight === rows[0].weight)
  );
}

export function applySharedStrengthWeight<T extends WorkoutPlanSet>(
  rows: T[],
  weight: string,
): T[] {
  if (!canShareStrengthWeight(rows)) return rows;
  return rows.map((row) => ({ ...row, weight }));
}

export function strengthRowsReady(rows: WorkoutPlanSet[], usesLoad: boolean) {
  return (
    rows.some((row) => row.completed !== false) &&
    rows.every(
      (row) =>
        row.completed === false ||
        (/^\d+$/.test(row.reps) &&
          Number(row.reps) > 0 &&
          Number(row.reps) <= 1000 &&
          (!usesLoad ||
            (row.weight.trim() !== "" &&
              Number.isFinite(Number(row.weight)) &&
              Number(row.weight) >= 0 &&
              Number(row.weight) <= 1000))),
    )
  );
}

export function strengthMatchesPrescription(rows: WorkoutPlanSet[], planned: WorkoutPlanSet[]) {
  return (
    rows.length === planned.length &&
    rows.every((row, index) => {
      const target = planned[index];
      return (
        row.reps === target.reps &&
        row.weight === target.weight &&
        row.completed !== false &&
        !row.method
      );
    })
  );
}
