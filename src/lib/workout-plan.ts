import type { getRecentLogsClient, WorkoutSetMethodInput } from "./supabase-log.browser";

export const WORKOUT_PLAN_DRAFT_KEY = "workout-plan-draft";
export const WORKOUT_PLAN_LOCATION_KEY = "workout-plan-location";

export type PlannerReadiness = "normal" | "fresh" | "tired";
export type PlannerLocation = "home" | "gym";
export type RecentWorkoutLog = Awaited<ReturnType<typeof getRecentLogsClient>>["recent"][number];

export type WorkoutPlanSet = {
  reps: string;
  weight: string;
  rpe: string;
  completed: boolean;
  method?: WorkoutSetMethodInput;
};

export type WorkoutPlanMovement = {
  exercise: string;
  workoutType: string;
  sourceDate: string;
  reason: string;
  setRows: WorkoutPlanSet[];
};

export type WorkoutPlanMethodBlock = {
  trainingMethodId: string;
  methodName: string;
  family: "exercise_group" | "timed_density";
  memberMovementIndexes: number[];
  rounds: string;
  restBetweenMovementsSeconds: string;
  restBetweenRoundsSeconds: string;
  blockDurationMinutes: string;
  workIntervalSeconds: string;
  restIntervalSeconds: string;
  config: Record<string, number | string | boolean>;
};

export type RecentWorkoutMethodBlock = WorkoutPlanMethodBlock & {
  id: string;
  sessionId: string;
  memberEntryIds: string[];
};

export type WorkoutPlanDraft = {
  version: 1;
  suggestedWorkoutId?: string;
  title: string;
  locationKind: PlannerLocation;
  basis: string;
  movements: WorkoutPlanMovement[];
  methodBlocks?: WorkoutPlanMethodBlock[];
};

export type WorkoutPlanSuggestion = WorkoutPlanDraft & {
  fallbackUsed: boolean;
  pattern: "repeat" | "rotation" | "manual";
};

export type WorkoutBasisOption = {
  date: string;
  exercises: string[];
  fallbackUsed: boolean;
};

type TrainingDay = { date: string; movements: RecentWorkoutLog[] };

const numberOrNull = (value: string | null | undefined) => {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

function roundLoad(value: number) {
  return Math.max(0, Math.round(value / 2.5) * 2.5);
}

function setRowsFor(log: RecentWorkoutLog): WorkoutPlanSet[] {
  if (log.setRows.length > 1 || log.setRows.some((set) => set.method)) {
    return log.setRows.map((set) => ({ ...set, completed: true }));
  }
  const count = Math.max(1, Math.round(numberOrNull(log.sets) ?? 1));
  const totalReps = numberOrNull(log.reps);
  const perSetReps =
    totalReps != null ? Math.max(1, Math.ceil(totalReps / count)).toString() : log.setRows[0]?.reps;
  return Array.from({ length: count }, () => ({
    reps: perSetReps ?? "",
    weight: log.weight || log.setRows[0]?.weight || "",
    rpe: "",
    completed: true,
  }));
}

function similarity(a: TrainingDay, b: TrainingDay) {
  const left = new Set(a.movements.map((movement) => movement.exercise.toLowerCase()));
  const right = new Set(b.movements.map((movement) => movement.exercise.toLowerCase()));
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 0;
  let overlap = 0;
  for (const movement of left) if (right.has(movement)) overlap += 1;
  return overlap / union.size;
}

function groupTrainingDays(logs: RecentWorkoutLog[]) {
  const grouped = new Map<string, TrainingDay>();
  for (const log of logs) {
    if (!log.date || !log.completed || !log.exercise) continue;
    const day = grouped.get(log.date) ?? { date: log.date, movements: [] };
    if (
      !day.movements.some(
        (movement) => movement.exercise.toLowerCase() === log.exercise.toLowerCase(),
      )
    ) {
      day.movements.push(log);
    }
    grouped.set(log.date, day);
  }
  return Array.from(grouped.values()).sort((a, b) => b.date.localeCompare(a.date));
}

function chooseBasis(days: TrainingDay[]) {
  const [latest, previous, beforePrevious] = days;
  if (
    latest &&
    previous &&
    beforePrevious &&
    similarity(latest, beforePrevious) >= 0.6 &&
    similarity(latest, previous) < 0.5
  ) {
    return { day: previous, pattern: "rotation" as const };
  }
  return { day: latest, pattern: "repeat" as const };
}

function matchingTrainingDays(logs: RecentWorkoutLog[], location: PlannerLocation) {
  const exact = logs.filter((log) => log.trainingLocation?.kind === location);
  const fallback = logs.filter((log) => !log.trainingLocation?.kind);
  const fallbackUsed = exact.length === 0;
  return {
    days: groupTrainingDays(fallbackUsed ? fallback : exact),
    fallbackUsed,
  };
}

export function getWorkoutBasisOptions(
  logs: RecentWorkoutLog[],
  location: PlannerLocation,
  limit = 6,
): WorkoutBasisOption[] {
  const { days, fallbackUsed } = matchingTrainingDays(logs, location);
  return days.slice(0, limit).map((day) => ({
    date: day.date,
    exercises: day.movements.map((movement) => movement.exercise),
    fallbackUsed,
  }));
}

function suggestMovement(log: RecentWorkoutLog, readiness: PlannerReadiness): WorkoutPlanMovement {
  let rows = setRowsFor(log);
  let preserveSetMethods = true;
  const weightedRows = rows.filter((set) => numberOrNull(set.weight) != null);
  const reps = rows
    .map((set) => numberOrNull(set.reps))
    .filter((value): value is number => value != null);
  const loggedRpe = log.setRows
    .map((set) => numberOrNull(set.rpe))
    .filter((value): value is number => value != null);
  const allAtFive = reps.length === rows.length && reps.every((value) => value >= 5);
  const comfortable = loggedRpe.length > 0 && Math.max(...loggedRpe) <= 8;

  let reason = "Repeats the most recent set pattern for this movement.";
  if (readiness === "tired") {
    preserveSetMethods = false;
    rows = rows.slice(0, Math.max(1, rows.length - 1)).map((set) => {
      const load = numberOrNull(set.weight);
      return { ...set, weight: load == null ? set.weight : String(roundLoad(load * 0.9)), rpe: "" };
    });
    reason = "Recovery option: one fewer set and about 10% less load than last time.";
  } else if (weightedRows.length > 0 && allAtFive && (comfortable || readiness === "fresh")) {
    preserveSetMethods = false;
    rows = rows.map((set) => {
      const load = numberOrNull(set.weight);
      return {
        ...set,
        weight: load == null ? set.weight : String(roundLoad(load + 2.5)),
        reps: "3",
        rpe: "",
      };
    });
    reason = comfortable
      ? "All recorded sets reached 5+ reps at RPE 8 or below, so load moves up 2.5 kg and reps reset to 3."
      : "You marked yourself fresh and reached 5+ reps last time, so load moves up 2.5 kg and reps reset to 3.";
  } else if (weightedRows.length > 0 && reps.length > 0 && reps.some((value) => value < 5)) {
    preserveSetMethods = false;
    rows = rows.map((set) => {
      const current = numberOrNull(set.reps);
      return {
        ...set,
        reps: current == null ? set.reps : String(Math.min(5, current + 1)),
        rpe: "",
      };
    });
    reason = "Keeps the same load and adds one rep where possible, working toward 5 per set.";
  } else if (weightedRows.length > 0 && allAtFive && !comfortable) {
    reason =
      "Repeats the load because 5 reps were reached but no comfortable RPE (8 or below) was logged.";
  }

  if (!preserveSetMethods) rows = rows.map((set) => ({ ...set, method: undefined }));

  return {
    exercise: log.exercise,
    workoutType: log.workoutType || "Other",
    sourceDate: log.date,
    reason,
    setRows: rows,
  };
}

export function buildWorkoutSuggestion(
  logs: RecentWorkoutLog[],
  location: PlannerLocation,
  readiness: PlannerReadiness,
  basisDate?: string | null,
  recentMethodBlocks: RecentWorkoutMethodBlock[] = [],
): WorkoutPlanSuggestion | null {
  const { days, fallbackUsed } = matchingTrainingDays(logs, location);
  const manuallyChosen = basisDate ? days.find((day) => day.date === basisDate) : null;
  const chosen = manuallyChosen
    ? { day: manuallyChosen, pattern: "manual" as const }
    : chooseBasis(days);
  if (!chosen.day) return null;

  const locationLabel = location === "home" ? "Home" : "Gym";
  const patternBasis =
    chosen.pattern === "manual"
      ? `You chose the training day from ${chosen.day.date} as the basis.`
      : chosen.pattern === "rotation"
        ? `Detected an alternating pattern and rotated to the session from ${chosen.day.date}.`
        : `Based on the most recent matching training day, ${chosen.day.date}.`;
  const fallbackBasis = fallbackUsed
    ? ` No ${locationLabel}-labelled history was found, so this uses older locationless logs.`
    : "";
  const movementIndexes = new Map(
    chosen.day.movements.map((movement, index) => [movement.entryId, index]),
  );
  const sourceMethodBlocks = recentMethodBlocks.filter((block) =>
    chosen.day.movements.some((movement) => movement.id === block.sessionId),
  );
  const methodBlocks =
    readiness === "tired"
      ? []
      : sourceMethodBlocks
          .map((block) => ({
            ...block,
            memberMovementIndexes: block.memberEntryIds
              .map((entryId) => movementIndexes.get(entryId))
              .filter((index): index is number => index != null),
          }))
          .filter(
            (block) =>
              block.memberMovementIndexes.length === block.memberEntryIds.length &&
              block.memberMovementIndexes.length >= (block.family === "timed_density" ? 1 : 2),
          )
          .map((block) => ({
            trainingMethodId: block.trainingMethodId,
            methodName: block.methodName,
            family: block.family,
            memberMovementIndexes: block.memberMovementIndexes,
            rounds: block.rounds,
            restBetweenMovementsSeconds: block.restBetweenMovementsSeconds,
            restBetweenRoundsSeconds: block.restBetweenRoundsSeconds,
            blockDurationMinutes: block.blockDurationMinutes,
            workIntervalSeconds: block.workIntervalSeconds,
            restIntervalSeconds: block.restIntervalSeconds,
            config: block.config,
          }));
  const methodBasis = methodBlocks.length
    ? ` Preserves ${methodBlocks.map((block) => block.methodName).join(" and ")} from that session.`
    : readiness === "tired" && sourceMethodBlocks.length
      ? " Advanced methods are left off this recovery suggestion."
      : "";

  return {
    version: 1,
    title: `${locationLabel} workout`,
    locationKind: location,
    basis: `${patternBasis}${fallbackBasis}${methodBasis}`,
    fallbackUsed,
    pattern: chosen.pattern,
    movements: chosen.day.movements.map((movement) => suggestMovement(movement, readiness)),
    methodBlocks,
  };
}

export function readWorkoutPlanDraft(value: string | null): WorkoutPlanDraft | null {
  if (!value) return null;
  try {
    const draft = JSON.parse(value) as WorkoutPlanDraft;
    if (
      draft.version !== 1 ||
      (draft.suggestedWorkoutId != null && typeof draft.suggestedWorkoutId !== "string") ||
      !draft.title ||
      !["home", "gym"].includes(draft.locationKind) ||
      !Array.isArray(draft.movements) ||
      draft.movements.length === 0 ||
      !draft.movements.every(
        (movement) =>
          typeof movement.exercise === "string" &&
          typeof movement.workoutType === "string" &&
          Array.isArray(movement.setRows) &&
          movement.setRows.length > 0 &&
          movement.setRows.every(
            (set) =>
              set.method == null ||
              (typeof set.method.trainingMethodId === "string" &&
                typeof set.method.methodName === "string" &&
                Array.isArray(set.method.segments) &&
                set.method.segments.length > 0),
          ),
      )
    ) {
      return null;
    }
    if (
      draft.methodBlocks != null &&
      (!Array.isArray(draft.methodBlocks) ||
        !draft.methodBlocks.every(
          (block) =>
            (block.family === "exercise_group" || block.family === "timed_density") &&
            typeof block.trainingMethodId === "string" &&
            Array.isArray(block.memberMovementIndexes) &&
            block.memberMovementIndexes.length >= (block.family === "timed_density" ? 1 : 2) &&
            new Set(block.memberMovementIndexes).size === block.memberMovementIndexes.length &&
            block.memberMovementIndexes.every(
              (index) => Number.isInteger(index) && index >= 0 && index < draft.movements.length,
            ),
        ))
    ) {
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}
