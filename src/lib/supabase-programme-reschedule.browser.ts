import { supabasePublicRpc } from "./supabase-public";
import { supabaseSelectByIds } from "./supabase-pagination.browser";
import { getScheduledWorkoutPlansClient } from "./supabase-plans.browser";
import { getUpcomingProgrammeScheduleClient } from "./supabase-programmes.browser";
import {
  programmeRescheduleClashes,
  type ProgrammeDateOverride,
  type ProgrammeReschedulePreview,
} from "./programme-reschedule";

export async function listProgrammeDateOverridesClient(assignmentIds: string[]) {
  if (!assignmentIds.length) return new Map<string, Record<string, ProgrammeDateOverride>>();
  const rows = await supabaseSelectByIds<{
    assignment_id: string;
    program_workout_id: string;
    scheduled_on: string;
    revision: number;
  }>("programme_session_dates", "assignment_id", assignmentIds, {
    select: "assignment_id,program_workout_id,scheduled_on,revision",
  }).catch((error: unknown) => {
    // Existing training remains usable until the additive migration is installed.
    if (error instanceof Error && /Code: (PGRST205|42P01)\b/.test(error.message)) return [];
    throw error;
  });
  const result = new Map<string, Record<string, ProgrammeDateOverride>>();
  for (const row of rows) {
    const dates = result.get(row.assignment_id) ?? {};
    dates[row.program_workout_id] = { date: row.scheduled_on, revision: row.revision };
    result.set(row.assignment_id, dates);
  }
  return result;
}

export async function getProgrammeRescheduleClashesClient(preview: ProgrammeReschedulePreview) {
  const dates = preview.sessions.map((session) => session.newDate!).sort();
  const [plans, programmes] = await Promise.all([
    getScheduledWorkoutPlansClient(dates[0], dates.at(-1)!),
    getUpcomingProgrammeScheduleClient(dates[0], dates.at(-1)!),
  ]);
  if (plans.length >= 100)
    throw new Error(
      "There are too many scheduled sessions to check this whole range. Review the calendar in Plan first.",
    );
  return programmeRescheduleClashes(preview, [
    ...plans
      .filter((plan) => plan.status !== "completed")
      .map((plan) => ({
        id: plan.suggestedWorkoutId,
        date: plan.suggestedFor ?? "",
        title: plan.title,
      })),
    ...programmes
      .filter((session) => session.assignmentId !== preview.assignmentId)
      .map((session) => ({
        id: `${session.assignmentId}:${session.programWorkoutId}`,
        date: session.scheduledDate,
        title: `${session.programmeName} · ${session.workoutName}`,
      })),
  ]);
}

export async function applyProgrammeRescheduleClient(
  preview: ProgrammeReschedulePreview,
  clashes: Awaited<ReturnType<typeof getProgrammeRescheduleClashesClient>>,
  undo = false,
) {
  return supabasePublicRpc<number>("reschedule_programme_sessions", {
    p_assignment_id: preview.assignmentId,
    p_current_workout_index: preview.currentWorkoutIndex,
    p_anchor_workout_id: preview.anchorWorkoutId,
    p_new_date: preview.newDate,
    p_allow_earlier: undo,
    p_clashes: clashes.map(({ id, date, workoutId }) => ({ id, date, workoutId })),
    p_snapshot: preview.sessions.map(
      ({ workoutId, date, scheduleRevision, personalRevision, locked }) => ({
        workoutId,
        date,
        scheduleRevision,
        personalRevision,
        locked,
      }),
    ),
  });
}
