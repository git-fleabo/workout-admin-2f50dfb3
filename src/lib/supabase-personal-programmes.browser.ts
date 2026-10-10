import { getCurrentPerson } from "./supabase-people.browser";
import { supabasePublicRpc, supabasePublicSelect } from "./supabase-public";
import {
  personalPlanFromTemplate,
  personalPlanSchema,
  type PersonalProgramme,
  type PersonalProgrammeSession,
} from "./personal-programme";
import type { ProgrammeAssignmentInput, ProgrammeTemplate } from "./supabase-programmes.browser";

type PersonalProgrammeRow = {
  assignment_id: string;
  name: string;
  personal_programme_sessions: Array<{
    program_workout_id: string;
    name: string;
    scheduled_on: string;
    revision: number;
    plan: unknown;
  }>;
};

export async function listPersonalProgrammesClient(): Promise<Map<string, PersonalProgramme>> {
  const rows = await supabasePublicSelect<PersonalProgrammeRow>("personal_programmes", {
    select:
      "assignment_id,name,personal_programme_sessions(program_workout_id,name,scheduled_on,revision,plan)",
  }).catch((error: unknown) => {
    // Allow existing programmes to keep working until this migration is installed.
    if (error instanceof Error && /Code: (PGRST205|42P01)\b/.test(error.message)) return [];
    throw error;
  });
  return new Map(
    rows.map((row) => [
      row.assignment_id,
      {
        name: row.name,
        sessions: row.personal_programme_sessions.map((session) => ({
          workoutId: session.program_workout_id,
          name: session.name,
          scheduledDate: session.scheduled_on,
          revision: session.revision,
          plan: personalPlanSchema.parse(session.plan),
        })),
      },
    ]),
  );
}

export async function createPersonalProgrammeClient(
  template: ProgrammeTemplate,
  input: ProgrammeAssignmentInput,
  name: string,
) {
  const sessions = personalPlanFromTemplate(template, input);
  return supabasePublicRpc<string>("create_personal_programme", {
    p_person_id: input.personId,
    p_program_id: template.id,
    p_name: name.trim(),
    p_started_on: input.startedOn,
    p_sessions: sessions,
    p_notes: input.notes ?? "",
  });
}

export async function savePersonalProgrammeSessionsClient(
  assignmentId: string,
  sessions: PersonalProgrammeSession[],
) {
  const updates = sessions.map((session) => ({
    ...session,
    plan: personalPlanSchema.parse(session.plan),
  }));
  return supabasePublicRpc<number>("save_personal_programme_sessions", {
    p_assignment_id: assignmentId,
    p_updates: updates,
  });
}

export async function getProgrammeExerciseContextClient(exerciseId: string) {
  const person = await getCurrentPerson();
  if (!person) return null;
  const assignments = await supabasePublicSelect<{
    id: string;
    program_id: string;
    current_workout_index: number;
  }>("program_assignments", {
    select: "id,program_id,current_workout_index",
    person_id: `eq.${person.id}`,
    status: "eq.active",
    limit: 1,
  });
  const assignment = assignments[0];
  if (!assignment) return null;
  const programmes = await listPersonalProgrammesClient();
  const personal = programmes.get(assignment.id);
  if (!personal) return null;
  const workouts = await supabasePublicSelect<{ id: string; sequence_index: number }>(
    "program_workouts",
    {
      select: "id,sequence_index",
      program_id: `eq.${assignment.program_id}`,
      order: "sequence_index.asc,id.asc",
    },
  );
  const next = workouts.slice(assignment.current_workout_index).flatMap((workout) => {
    const session = personal.sessions.find((item) => item.workoutId === workout.id);
    const movement = session?.plan.movements.find((item) => item.exerciseId === exerciseId);
    return session && movement ? [{ session, movement }] : [];
  })[0];
  if (!next) return null;
  const completed = await supabasePublicSelect<{
    completed_session_id: string;
    suggested_workout_entries: Array<{ exercise_id: string }>;
  }>("suggested_workouts", {
    select: "completed_session_id,suggested_workout_entries(exercise_id)",
    program_assignment_id: `eq.${assignment.id}`,
    status: "eq.completed",
    order: "created_at.desc",
  });
  const last = completed.find((plan) =>
    plan.suggested_workout_entries.some((entry) => entry.exercise_id === exerciseId),
  );
  return {
    assignmentId: assignment.id,
    programmeName: personal.name,
    ...next,
    completedSessionId: last?.completed_session_id,
  };
}
