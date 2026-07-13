import { getCurrentPerson } from "./supabase-people.browser";
import {
  supabasePublicDelete,
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import type {
  PlannerReadiness,
  RecentWorkoutMethodBlock,
  WorkoutPlanDraft,
  WorkoutPlanMethodBlock,
  WorkoutPlanMovement,
} from "./workout-plan";

type SuggestedWorkoutStatus = "pending" | "accepted" | "completed" | "skipped" | "archived";

type SuggestedSetRow = {
  id: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  completed: boolean;
  suggested_workout_set_segments: SuggestedSetSegmentRow[] | null;
};

type SuggestedSetSegmentRow = {
  training_method_id: string;
  method_name: string;
  segment_index: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  rest_after_seconds: number | null;
  range_of_motion: string | null;
  config: Record<string, number | string | boolean> | null;
};

type SuggestedEntryRow = {
  id: string;
  name: string;
  workout_type: string | null;
  order_index: number;
  source_date: string | null;
  reason: string | null;
  suggested_workout_sets: SuggestedSetRow[] | null;
};

type SuggestedWorkoutRow = {
  id: string;
  title: string;
  basis: string | null;
  readiness: PlannerReadiness | null;
  status: SuggestedWorkoutStatus;
  created_at: string;
  training_locations: { kind: string | null; name: string | null } | null;
  suggested_workout_entries: SuggestedEntryRow[] | null;
  suggested_workout_method_blocks: SuggestedMethodBlockRow[] | null;
};

type SuggestedMethodBlockRow = {
  id: string;
  training_method_id: string;
  method_name: string;
  family: "exercise_group" | "timed_density";
  order_index: number;
  rounds: number | null;
  rest_between_movements_seconds: number | null;
  rest_between_rounds_seconds: number | null;
  block_duration_seconds: number | null;
  work_interval_seconds: number | null;
  rest_interval_seconds: number | null;
  config: Record<string, number | string | boolean> | null;
  suggested_workout_method_block_entries: Array<{
    suggested_workout_entry_id: string;
    sequence_index: number;
  }> | null;
};

type RecentMethodBlockRow = {
  id: string;
  session_id: string;
  training_method_id: string;
  method_name: string;
  family: "exercise_group" | "timed_density";
  order_index: number;
  rounds: number | null;
  rest_between_movements_seconds: number | null;
  rest_between_rounds_seconds: number | null;
  block_duration_seconds: number | null;
  work_interval_seconds: number | null;
  rest_interval_seconds: number | null;
  config: Record<string, number | string | boolean> | null;
  session_method_block_entries: Array<{
    session_entry_id: string;
    sequence_index: number;
  }> | null;
};

export type SavedWorkoutPlan = WorkoutPlanDraft & {
  suggestedWorkoutId: string;
  readiness: PlannerReadiness | null;
  status: SuggestedWorkoutStatus;
  createdAt: string;
};

const toNumber = (value: string) => {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const asText = (value: number | null) => (value == null ? "" : String(value));

function methodBlockFromRow(
  block: SuggestedMethodBlockRow,
  movementIndexByEntryId: Map<string, number>,
): WorkoutPlanMethodBlock | null {
  const members = [...(block.suggested_workout_method_block_entries ?? [])].sort(
    (a, b) => a.sequence_index - b.sequence_index,
  );
  const memberMovementIndexes = members
    .map((member) => movementIndexByEntryId.get(member.suggested_workout_entry_id))
    .filter((index): index is number => index != null);
  if (
    memberMovementIndexes.length !== members.length ||
    memberMovementIndexes.length < (block.family === "timed_density" ? 1 : 2)
  ) {
    return null;
  }
  return {
    trainingMethodId: block.training_method_id,
    methodName: block.method_name,
    family: block.family,
    memberMovementIndexes,
    rounds: asText(block.rounds),
    restBetweenMovementsSeconds: asText(block.rest_between_movements_seconds),
    restBetweenRoundsSeconds: asText(block.rest_between_rounds_seconds),
    blockDurationMinutes:
      block.block_duration_seconds == null ? "" : String(block.block_duration_seconds / 60),
    workIntervalSeconds: asText(block.work_interval_seconds),
    restIntervalSeconds: asText(block.rest_interval_seconds),
    config: block.config ?? {},
  };
}

async function requirePerson() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("This account is not linked to a person.");
  return person;
}

function movementFromRow(entry: SuggestedEntryRow): WorkoutPlanMovement {
  const sets = [...(entry.suggested_workout_sets ?? [])].sort(
    (a, b) => a.set_number - b.set_number,
  );
  return {
    exercise: entry.name,
    workoutType: entry.workout_type ?? "Other",
    sourceDate: entry.source_date ?? "",
    reason: entry.reason ?? "",
    setRows: sets.map((set) => ({
      reps: asText(set.reps),
      weight: asText(set.weight),
      rpe: asText(set.rpe),
      completed: set.completed,
      method: (() => {
        const segments = [...(set.suggested_workout_set_segments ?? [])].sort(
          (a, b) => a.segment_index - b.segment_index,
        );
        const first = segments[0];
        if (!first || segments.length < 2) return undefined;
        return {
          trainingMethodId: first.training_method_id,
          methodName: first.method_name,
          systemKey: typeof first.config?.system_key === "string" ? first.config.system_key : null,
          segments: segments.slice(1).map((segment) => ({
            reps: asText(segment.reps),
            weight: asText(segment.weight),
            rpe: asText(segment.rpe),
            restAfterSeconds: asText(segment.rest_after_seconds),
            rangeOfMotion: segment.range_of_motion ?? "full",
          })),
          config: first.config ?? {},
        };
      })(),
    })),
  };
}

function planFromRow(row: SuggestedWorkoutRow): SavedWorkoutPlan | null {
  const locationKind = row.training_locations?.kind;
  if (locationKind !== "home" && locationKind !== "gym") return null;
  const orderedEntries = [...(row.suggested_workout_entries ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );
  const movements: WorkoutPlanMovement[] = [];
  const movementIndexByEntryId = new Map<string, number>();
  for (const entry of orderedEntries) {
    const movement = movementFromRow(entry);
    if (!movement.setRows.length) continue;
    movementIndexByEntryId.set(entry.id, movements.length);
    movements.push(movement);
  }
  if (!movements.length) return null;
  const methodBlocks = [...(row.suggested_workout_method_blocks ?? [])]
    .sort((a, b) => a.order_index - b.order_index)
    .map((block) => methodBlockFromRow(block, movementIndexByEntryId))
    .filter((block): block is WorkoutPlanMethodBlock => block != null);
  return {
    version: 1,
    suggestedWorkoutId: row.id,
    title: row.title,
    locationKind,
    basis: row.basis ?? "Saved workout plan.",
    movements,
    methodBlocks,
    readiness: row.readiness,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function saveWorkoutPlanClient({
  draft,
  readiness,
  status,
}: {
  draft: WorkoutPlanDraft;
  readiness: PlannerReadiness;
  status: "pending" | "accepted";
}) {
  const person = await requirePerson();
  const locations = await supabasePublicSelect<{ id: string }>("training_locations", {
    select: "id",
    person_id: `eq.${person.id}`,
    kind: `eq.${draft.locationKind}`,
    limit: 1,
  });
  const location = locations[0];
  if (!location) throw new Error(`Add a ${draft.locationKind} training location first.`);

  const inserted = await supabasePublicInsert<{ id: string }>("suggested_workouts", {
    person_id: person.id,
    training_location_id: location.id,
    suggested_for: new Date().toISOString().slice(0, 10),
    status,
    title: draft.title,
    readiness,
    basis: draft.basis,
  });
  const workout = inserted[0];
  if (!workout) throw new Error("The workout plan was not saved.");

  try {
    const entryIdsByMovementIndex = new Map<number, string>();
    for (const [movementIndex, movement] of draft.movements.entries()) {
      const entries = await supabasePublicInsert<{ id: string }>("suggested_workout_entries", {
        suggested_workout_id: workout.id,
        name: movement.exercise,
        workout_type: movement.workoutType || null,
        order_index: movementIndex,
        source_date: movement.sourceDate || null,
        reason: movement.reason || null,
      });
      const entry = entries[0];
      if (!entry) throw new Error(`${movement.exercise} was not saved to the plan.`);
      entryIdsByMovementIndex.set(movementIndex, entry.id);
      for (const [setIndex, set] of movement.setRows.entries()) {
        const insertedSets = await supabasePublicInsert<{ id: string }>("suggested_workout_sets", {
          suggested_workout_entry_id: entry.id,
          set_number: setIndex + 1,
          reps: toNumber(set.reps),
          weight: toNumber(set.weight),
          rpe: toNumber(set.rpe),
          completed: set.completed,
        });
        const insertedSet = insertedSets[0];
        if (!insertedSet) {
          throw new Error(`${movement.exercise} set ${setIndex + 1} was not saved to the plan.`);
        }
        if (set.method?.segments.length) {
          const segments = [
            {
              reps: set.reps,
              weight: set.weight,
              rpe: set.rpe,
              restAfterSeconds: "0",
              rangeOfMotion: String(set.method.config.base_range_of_motion ?? "full"),
            },
            ...set.method.segments,
          ];
          await supabasePublicInsert(
            "suggested_workout_set_segments",
            segments.map((segment, segmentIndex) => ({
              suggested_workout_set_id: insertedSet.id,
              training_method_id: set.method?.trainingMethodId,
              method_name: set.method?.methodName,
              segment_index: segmentIndex,
              reps: toNumber(segment.reps),
              weight: toNumber(segment.weight),
              rpe: toNumber(segment.rpe),
              rest_after_seconds: toNumber(segment.restAfterSeconds),
              range_of_motion: segment.rangeOfMotion || null,
              config: set.method?.config ?? {},
            })),
          );
        }
      }
    }
    for (const [blockIndex, block] of (draft.methodBlocks ?? []).entries()) {
      const memberEntryIds = block.memberMovementIndexes
        .map((movementIndex) => entryIdsByMovementIndex.get(movementIndex))
        .filter((id): id is string => Boolean(id));
      if (
        memberEntryIds.length !== block.memberMovementIndexes.length ||
        memberEntryIds.length < (block.family === "timed_density" ? 1 : 2)
      ) {
        throw new Error(`${block.methodName} has an invalid planned movement group.`);
      }
      const insertedBlocks = await supabasePublicInsert<{ id: string }>(
        "suggested_workout_method_blocks",
        {
          suggested_workout_id: workout.id,
          training_method_id: block.trainingMethodId,
          method_name: block.methodName,
          family: block.family,
          order_index: blockIndex,
          rounds: toNumber(block.rounds),
          rest_between_movements_seconds: toNumber(block.restBetweenMovementsSeconds),
          rest_between_rounds_seconds: toNumber(block.restBetweenRoundsSeconds),
          block_duration_seconds:
            toNumber(block.blockDurationMinutes) == null
              ? null
              : Math.round(Number(block.blockDurationMinutes) * 60),
          work_interval_seconds: toNumber(block.workIntervalSeconds),
          rest_interval_seconds: toNumber(block.restIntervalSeconds),
          config: block.config,
        },
      );
      const insertedBlock = insertedBlocks[0];
      if (!insertedBlock) throw new Error(`${block.methodName} was not saved to the plan.`);
      await supabasePublicInsert(
        "suggested_workout_method_block_entries",
        memberEntryIds.map((entryId, sequenceIndex) => ({
          block_id: insertedBlock.id,
          suggested_workout_entry_id: entryId,
          sequence_index: sequenceIndex,
        })),
      );
    }
    await supabasePublicUpdate(
      "suggested_workouts",
      {
        person_id: `eq.${person.id}`,
        training_location_id: `eq.${location.id}`,
        status: "in.(pending,accepted)",
        id: `neq.${workout.id}`,
      },
      { status: "archived" },
    );
  } catch (error) {
    await supabasePublicDelete("suggested_workouts", { id: `eq.${workout.id}` }).catch(
      () => undefined,
    );
    throw error;
  }

  return { ...draft, suggestedWorkoutId: workout.id };
}

export async function getNextSuggestedWorkoutsClient() {
  const person = await requirePerson();
  const rows = await supabasePublicSelect<SuggestedWorkoutRow>("suggested_workouts", {
    select:
      "id,title,basis,readiness,status,created_at,training_locations(kind,name),suggested_workout_entries(id,name,workout_type,order_index,source_date,reason,suggested_workout_sets(id,set_number,reps,weight,rpe,completed,suggested_workout_set_segments(training_method_id,method_name,segment_index,reps,weight,rpe,rest_after_seconds,range_of_motion,config))),suggested_workout_method_blocks(id,training_method_id,method_name,family,order_index,rounds,rest_between_movements_seconds,rest_between_rounds_seconds,block_duration_seconds,work_interval_seconds,rest_interval_seconds,config,suggested_workout_method_block_entries(suggested_workout_entry_id,sequence_index))",
    status: "in.(pending,accepted)",
    person_id: `eq.${person.id}`,
    order: "created_at.desc",
    limit: 10,
  });
  const plans = rows.map(planFromRow).filter((plan): plan is SavedWorkoutPlan => plan != null);
  const seen = new Set<string>();
  return plans.filter((plan) => {
    if (seen.has(plan.locationKind)) return false;
    seen.add(plan.locationKind);
    return true;
  });
}

export async function getRecentWorkoutMethodBlocksClient(
  sessionIds: string[],
): Promise<RecentWorkoutMethodBlock[]> {
  const uniqueSessionIds = Array.from(new Set(sessionIds.filter(Boolean))).slice(0, 100);
  if (!uniqueSessionIds.length) return [];
  const rows = await supabasePublicSelect<RecentMethodBlockRow>("session_method_blocks", {
    select:
      "id,session_id,training_method_id,method_name,family,order_index,rounds,rest_between_movements_seconds,rest_between_rounds_seconds,block_duration_seconds,work_interval_seconds,rest_interval_seconds,config,session_method_block_entries(session_entry_id,sequence_index)",
    session_id: `in.(${uniqueSessionIds.join(",")})`,
    family: "in.(exercise_group,timed_density)",
    order: "order_index.asc",
    limit: 500,
  });
  return rows.map((block) => ({
    id: block.id,
    sessionId: block.session_id,
    trainingMethodId: block.training_method_id,
    methodName: block.method_name,
    family: block.family,
    memberMovementIndexes: [],
    memberEntryIds: [...(block.session_method_block_entries ?? [])]
      .sort((a, b) => a.sequence_index - b.sequence_index)
      .map((member) => member.session_entry_id),
    rounds: asText(block.rounds),
    restBetweenMovementsSeconds: asText(block.rest_between_movements_seconds),
    restBetweenRoundsSeconds: asText(block.rest_between_rounds_seconds),
    blockDurationMinutes:
      block.block_duration_seconds == null ? "" : String(block.block_duration_seconds / 60),
    workIntervalSeconds: asText(block.work_interval_seconds),
    restIntervalSeconds: asText(block.rest_interval_seconds),
    config: block.config ?? {},
  }));
}

export async function updateSuggestedWorkoutStatusClient(
  id: string,
  status: "accepted" | "skipped" | "archived",
) {
  await supabasePublicUpdate("suggested_workouts", { id: `eq.${id}` }, { status });
  return { ok: true };
}

export async function completeSuggestedWorkoutClient(id: string, sessionId: string) {
  await supabasePublicUpdate(
    "suggested_workouts",
    { id: `eq.${id}` },
    { status: "completed", completed_session_id: sessionId },
  );
  return { ok: true };
}
