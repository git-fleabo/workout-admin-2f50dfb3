import type {
  ProgrammeSupportPlanHistoryEntry,
  SkillPracticeHistoryEntry,
} from "./programme-support";
import { getCurrentPerson } from "./supabase-people.browser";
import { supabasePublicSelect } from "./supabase-public";

type PlannedSetRow = {
  reps: number | string | null;
  duration_seconds: number | string | null;
};

type CompletedSupportPlanRow = {
  goal_id: string;
  suggested_for: string | null;
  completed_session_id: string | null;
  suggested_workout_entries: Array<{
    exercise_id: string | null;
    name: string;
    tracking_mode: string | null;
    suggested_workout_sets: PlannedSetRow[] | null;
  }> | null;
};

type CompletedEntryRow = {
  session_id: string;
  exercise_id: string | null;
  name: string;
  completed: boolean;
  entry_sets: Array<{
    reps: number | string | null;
    duration_seconds: number | string | null;
    completed: boolean;
  }> | null;
};

type SupportPlanHistoryRow = {
  suggested_for: string | null;
  status: string;
  goal_id: string | null;
  mobility_practice_run_id: string | null;
  training_locations: { kind: string | null } | null;
  suggested_workout_entries: Array<{
    tracking_mode: string | null;
    suggested_workout_sets: PlannedSetRow[] | null;
  }> | null;
};

function positiveNumber(value: number | string | null) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function setDose(
  set: { reps: number | string | null; duration_seconds: number | string | null },
  trackingMode: string | null,
) {
  return trackingMode === "hold" || trackingMode === "grip_hold"
    ? positiveNumber(set.duration_seconds)
    : positiveNumber(set.reps);
}

export async function getProgrammeSkillSupportHistoryClient(assignmentId: string) {
  const person = await getCurrentPerson();
  if (!person) throw new Error("This account is not linked to a person.");
  const plans = await supabasePublicSelect<CompletedSupportPlanRow>("suggested_workouts", {
    select:
      "goal_id,suggested_for,completed_session_id,suggested_workout_entries(exercise_id,name,tracking_mode,suggested_workout_sets(reps,duration_seconds))",
    person_id: `eq.${person.id}`,
    program_assignment_id: `eq.${assignmentId}`,
    program_workout_id: "is.null",
    goal_id: "not.is.null",
    status: "eq.completed",
    order: "suggested_for.desc,created_at.desc",
    limit: 200,
  });
  const sessionIds = Array.from(
    new Set(
      plans.map((plan) => plan.completed_session_id).filter((id): id is string => Boolean(id)),
    ),
  );
  const entryBatches: Promise<CompletedEntryRow[]>[] = [];
  for (let index = 0; index < sessionIds.length; index += 100) {
    const batch = sessionIds.slice(index, index + 100);
    entryBatches.push(
      supabasePublicSelect<CompletedEntryRow>("session_entries", {
        select: "session_id,exercise_id,name,completed,entry_sets(reps,duration_seconds,completed)",
        session_id: `in.(${batch.join(",")})`,
        limit: 1000,
      }),
    );
  }
  const completedEntries = (await Promise.all(entryBatches)).flat();
  const entriesBySession = new Map<string, CompletedEntryRow[]>();
  for (const entry of completedEntries) {
    entriesBySession.set(entry.session_id, [
      ...(entriesBySession.get(entry.session_id) ?? []),
      entry,
    ]);
  }

  const history: Record<string, SkillPracticeHistoryEntry[]> = {};
  for (const plan of plans) {
    const planned = plan.goal_id ? plan.suggested_workout_entries?.[0] : undefined;
    if (!planned || !plan.suggested_for || !plan.completed_session_id) continue;
    const plannedDoses = (planned.suggested_workout_sets ?? [])
      .map((set) => setDose(set, planned.tracking_mode))
      .filter((value): value is number => value != null);
    if (!plannedDoses.length) continue;
    const plannedDose = Math.min(...plannedDoses);
    const matchingEntry = (entriesBySession.get(plan.completed_session_id) ?? [])
      .filter(
        (entry) =>
          (planned.exercise_id && entry.exercise_id === planned.exercise_id) ||
          entry.name.trim().toLowerCase() === planned.name.trim().toLowerCase(),
      )
      .sort((left, right) => (right.entry_sets?.length ?? 0) - (left.entry_sets?.length ?? 0))[0];
    const successfulSets = (matchingEntry?.entry_sets ?? []).filter(
      (set) => set.completed && (setDose(set, planned.tracking_mode) ?? 0) >= plannedDose,
    ).length;
    const item: SkillPracticeHistoryEntry = {
      date: plan.suggested_for,
      plannedSets: plannedDoses.length,
      plannedDose,
      successful: Boolean(matchingEntry?.completed && successfulSets >= plannedDoses.length),
    };
    history[plan.goal_id] = [...(history[plan.goal_id] ?? []), item];
  }
  return history;
}

export async function getProgrammeSupportBlockHistoryClient(
  assignmentId: string,
): Promise<ProgrammeSupportPlanHistoryEntry[]> {
  const person = await getCurrentPerson();
  if (!person) throw new Error("This account is not linked to a person.");
  const plans = await supabasePublicSelect<SupportPlanHistoryRow>("suggested_workouts", {
    select:
      "suggested_for,status,goal_id,mobility_practice_run_id,training_locations(kind),suggested_workout_entries(tracking_mode,suggested_workout_sets(reps,duration_seconds))",
    person_id: `eq.${person.id}`,
    program_assignment_id: `eq.${assignmentId}`,
    program_workout_id: "is.null",
    status: "in.(pending,accepted,completed,skipped)",
    order: "suggested_for.desc,created_at.desc",
    limit: 200,
  });
  return plans.flatMap((plan) => {
    if (!plan.suggested_for || (!plan.goal_id && !plan.mobility_practice_run_id)) return [];
    const planned = plan.goal_id ? plan.suggested_workout_entries?.[0] : undefined;
    const plannedDoses = (planned?.suggested_workout_sets ?? [])
      .map((set) => setDose(set, planned?.tracking_mode ?? null))
      .filter((value): value is number => value != null);
    const holds = planned?.tracking_mode === "hold" || planned?.tracking_mode === "grip_hold";
    return [
      {
        date: plan.suggested_for,
        status: plan.status,
        goalId: plan.goal_id,
        mobilityRunId: plan.mobility_practice_run_id,
        locationKind: plan.training_locations?.kind === "home" ? "home" : "gym",
        plannedSets: plannedDoses.length || undefined,
        plannedDose: plannedDoses.length ? Math.min(...plannedDoses) : undefined,
        doseUnit: plannedDoses.length ? (holds ? "seconds" : "reps") : undefined,
      },
    ];
  });
}
