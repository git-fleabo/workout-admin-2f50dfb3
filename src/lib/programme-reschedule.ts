import { programmeWorkoutScheduledDate } from "./adaptive-strength.ts";
import type {
  ProgrammeAssignment,
  ProgrammeTemplate,
  ProgrammeTemplateWorkout,
} from "./supabase-programmes.browser.ts";

export type ProgrammeDateOverride = { date: string; revision: number };
export type ProgrammeDateSnapshot = {
  workoutId: string;
  date: string | null;
  scheduleRevision: number;
  personalRevision: number | null;
  locked: boolean;
};
export type ProgrammeDateChange = ProgrammeDateSnapshot & {
  name: string;
  position: number;
  newDate: string | null;
};
export type ProgrammeReschedulePreview = {
  assignmentId: string;
  currentWorkoutIndex: number;
  anchorWorkoutId: string;
  newDate: string;
  days: number;
  sessions: ProgrammeDateChange[];
};

export function programmeSessionScheduledDate(
  assignment: Pick<ProgrammeAssignment, "startedOn" | "personalProgramme" | "scheduleOverrides">,
  workout: Pick<ProgrammeTemplateWorkout, "id" | "weekNumber" | "dayNumber">,
) {
  return (
    assignment.scheduleOverrides?.[workout.id]?.date ??
    assignment.personalProgramme?.sessions.find((session) => session.workoutId === workout.id)
      ?.scheduledDate ??
    programmeWorkoutScheduledDate(assignment.startedOn, workout.weekNumber, workout.dayNumber)
  );
}

function isoTime(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? time : null;
}

export function buildProgrammeReschedulePreview({
  assignment,
  template,
  lockedWorkoutIds,
  newDate,
  today,
}: {
  assignment: ProgrammeAssignment;
  template: ProgrammeTemplate;
  lockedWorkoutIds: string[];
  newDate: string;
  today: string;
}): ProgrammeReschedulePreview {
  if (assignment.status !== "active" || assignment.programId !== template.id)
    throw new Error("Choose your active programme first.");
  const anchor = template.workouts[assignment.currentWorkoutIndex];
  if (!anchor) throw new Error("There are no remaining programme sessions.");
  if (lockedWorkoutIds.includes(anchor.id))
    throw new Error("This session has already started. Finish it before moving dates.");
  const anchorDate = programmeSessionScheduledDate(assignment, anchor);
  const from = anchorDate ? isoTime(anchorDate) : null;
  const to = isoTime(newDate);
  const todayTime = isoTime(today);
  if (from === null) throw new Error("Set a suggested date for this session in Plan first.");
  if (to === null || todayTime === null || to < todayTime || to <= from)
    throw new Error("Choose today or a later date, after this session’s current date.");
  const days = (to - from) / 86400000;
  const sessions = template.workouts.slice(assignment.currentWorkoutIndex).map((workout, index) => {
    const date = programmeSessionScheduledDate(assignment, workout);
    const time = date ? isoTime(date) : null;
    if (time === null)
      throw new Error(
        "Every remaining session needs a suggested date before moving the programme.",
      );
    const locked = lockedWorkoutIds.includes(workout.id);
    const shifted = locked ? time : time + days * 86400000;
    if (shifted > Date.parse("9999-12-31T00:00:00Z")) throw new Error("Choose an earlier date.");
    return {
      workoutId: workout.id,
      position: assignment.currentWorkoutIndex + index,
      name:
        assignment.personalProgramme?.sessions.find((session) => session.workoutId === workout.id)
          ?.name ?? workout.name,
      date,
      newDate: new Date(shifted).toISOString().slice(0, 10),
      scheduleRevision: assignment.scheduleOverrides?.[workout.id]?.revision ?? 0,
      personalRevision:
        assignment.personalProgramme?.sessions.find((session) => session.workoutId === workout.id)
          ?.revision ?? null,
      locked,
    };
  });
  if (
    sessions.some((session, index) => index > 0 && session.newDate! < sessions[index - 1].newDate!)
  )
    throw new Error(
      "These dates would change the session order around a fixed session. Review those dates in Plan first.",
    );
  return {
    assignmentId: assignment.id,
    currentWorkoutIndex: assignment.currentWorkoutIndex,
    anchorWorkoutId: anchor.id,
    newDate,
    days,
    sessions,
  };
}

export function programmeRescheduleClashes(
  preview: ProgrammeReschedulePreview,
  otherSessions: Array<{ id: string; date: string; title: string }>,
) {
  return preview.sessions
    .filter((session) => !session.locked)
    .flatMap((session) =>
      otherSessions
        .filter((other) => other.date === session.newDate)
        .map((other) => ({
          workoutId: session.workoutId,
          date: other.date,
          title: other.title,
          id: other.id,
        })),
    );
}

export function reverseProgrammeReschedule(
  preview: ProgrammeReschedulePreview,
): ProgrammeReschedulePreview {
  return {
    ...preview,
    newDate: preview.sessions[0].date!,
    days: -preview.days,
    sessions: preview.sessions.map((session) => ({
      ...session,
      date: session.newDate,
      newDate: session.date,
      scheduleRevision: session.scheduleRevision + (session.locked ? 0 : 1),
    })),
  };
}
