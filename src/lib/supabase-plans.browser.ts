import { getCurrentPerson } from "./supabase-people.browser";
import {
  supabasePublicDelete,
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import type { PlannerReadiness, WorkoutPlanDraft, WorkoutPlanMovement } from "./workout-plan";

type SuggestedWorkoutStatus = "pending" | "accepted" | "completed" | "skipped" | "archived";

type SuggestedSetRow = {
  set_number: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  completed: boolean;
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
    })),
  };
}

function planFromRow(row: SuggestedWorkoutRow): SavedWorkoutPlan | null {
  const locationKind = row.training_locations?.kind;
  if (locationKind !== "home" && locationKind !== "gym") return null;
  const movements = [...(row.suggested_workout_entries ?? [])]
    .sort((a, b) => a.order_index - b.order_index)
    .map(movementFromRow)
    .filter((movement) => movement.setRows.length > 0);
  if (!movements.length) return null;
  return {
    version: 1,
    suggestedWorkoutId: row.id,
    title: row.title,
    locationKind,
    basis: row.basis ?? "Saved workout plan.",
    movements,
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
      await supabasePublicInsert(
        "suggested_workout_sets",
        movement.setRows.map((set, setIndex) => ({
          suggested_workout_entry_id: entry.id,
          set_number: setIndex + 1,
          reps: toNumber(set.reps),
          weight: toNumber(set.weight),
          rpe: toNumber(set.rpe),
          completed: set.completed,
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
      "id,title,basis,readiness,status,created_at,training_locations(kind,name),suggested_workout_entries(id,name,workout_type,order_index,source_date,reason,suggested_workout_sets(set_number,reps,weight,rpe,completed))",
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
