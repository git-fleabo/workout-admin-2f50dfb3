import { getCurrentPerson } from "./supabase-people.browser";
import {
  supabasePublicInsert,
  supabasePublicRpc,
  supabasePublicUpdate,
  supabasePublicSelect,
} from "./supabase-public";
import { supabaseSelectAll } from "./supabase-pagination.browser";
import {
  recoveryRoutineSchema,
  validateActuals,
  type RecoveryRoutine,
  type RecoveryRoutineInput,
  type RecoverySession,
  type RecoveryActual,
  type LegacyRecoverySchedule,
} from "./recovery";
import { todayISO } from "./date";
async function personId() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("Connect your training profile first.");
  return person.id;
}
export async function listRecoveryClient() {
  const person_id = `eq.${await personId()}`;
  const [routines, sessions, schedules] = await Promise.all([
    supabaseSelectAll<RecoveryRoutine>("recovery_routines", {
      person_id,
      select: "*",
      order: "created_at.asc",
    }),
    supabaseSelectAll<RecoverySession>("recovery_sessions", {
      person_id,
      select: "*",
      order: "session_date.desc,created_at.desc",
    }),
    supabaseSelectAll<LegacyRecoverySchedule>("suggested_workouts", {
      person_id,
      select:
        "id,mobility_practice_run_id,suggested_for,title,status,mobility_practice_runs!inner(status)",
      "mobility_practice_runs.status": "eq.active",
      mobility_practice_run_id: "not.is.null",
      plan_kind: "eq.mobility",
      program_workout_id: "is.null",
      status: "in.(pending,accepted)",
      order: "suggested_for.asc",
    }),
  ]);
  return { routines, sessions, schedules };
}
export async function saveRecoveryRoutineClient(
  input: RecoveryRoutineInput,
  previous?: RecoveryRoutine,
) {
  const body = recoveryRoutineSchema.parse(input);
  const person_id = await personId();
  const rows = previous
    ? await supabasePublicUpdate<RecoveryRoutine>(
        "recovery_routines",
        {
          id: `eq.${previous.id}`,
          person_id: `eq.${person_id}`,
          version: `eq.${previous.version}`,
        },
        body,
      )
    : await supabasePublicInsert<RecoveryRoutine>("recovery_routines", { ...body, person_id });
  if (!rows[0]) throw new Error("This routine changed elsewhere. Reload it before editing again.");
  return rows[0];
}
export async function startRecoveryClient(
  routineId: string,
  templateId: string,
  legacy = false,
  scheduleId?: string,
) {
  return supabasePublicRpc<RecoverySession>("start_recovery_session", {
    p_person_id: await personId(),
    p_routine_id: legacy ? null : routineId,
    p_legacy_run_id: legacy ? routineId : null,
    p_template_id: templateId,
    p_date: todayISO(),
    p_schedule_id: scheduleId ?? null,
  });
}
export async function saveRecoverySessionClient(
  session: RecoverySession,
  input: { actuals: RecoveryActual[]; pain: number | null; notes: string; check_enabled: boolean },
  status: RecoverySession["status"] = "draft",
) {
  const actuals = ["cancelled", "skipped"].includes(status)
    ? []
    : validateActuals(session, input.actuals);
  if (input.pain !== null && (!Number.isFinite(input.pain) || input.pain < 0 || input.pain > 10))
    throw new Error("Discomfort must be 0–10 or left blank.");
  if (status === "completed" && session.snapshot.mode === "measured" && !actuals.length)
    throw new Error("Record actual work before completing, or cancel this session.");
  const person_id = await personId();
  const rows = await supabasePublicUpdate<RecoverySession>(
    "recovery_sessions",
    {
      id: `eq.${session.id}`,
      person_id: `eq.${person_id}`,
      version: `eq.${session.version}`,
      status: "eq.draft",
    },
    {
      ...input,
      actuals,
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    },
  );
  if (rows[0]) return rows[0];
  // A response lost after a successful finish may be retried safely.
  const current = await supabasePublicSelect<RecoverySession>("recovery_sessions", {
    id: `eq.${session.id}`,
    person_id: `eq.${person_id}`,
    select: "*",
  });
  if (status !== "draft" && current[0]?.status === status) return current[0];
  throw new Error("This session changed elsewhere. Reopen it to use the latest saved version.");
}
export async function saveRecoveryResponseClient(
  session: RecoverySession,
  response: NonNullable<RecoverySession["response"]>,
  notes: string,
) {
  const rows = await supabasePublicUpdate<RecoverySession>(
    "recovery_sessions",
    {
      id: `eq.${session.id}`,
      person_id: `eq.${await personId()}`,
      version: `eq.${session.version}`,
      status: "eq.completed",
    },
    { response, response_notes: notes },
  );
  if (!rows[0]) throw new Error("This check changed elsewhere. Reload and try again.");
  return rows[0];
}
export async function classifyLegacyRecoveryClient(sessionId: string, recoveryOnly: boolean) {
  const rows = await supabasePublicUpdate(
    "sessions",
    {
      id: `eq.${sessionId}`,
      person_id: `eq.${await personId()}`,
      mobility_practice_run_id: "not.is.null",
    },
    { recovery_only: recoveryOnly },
  );
  if (!rows.length) throw new Error("That linked practice could not be updated.");
}
