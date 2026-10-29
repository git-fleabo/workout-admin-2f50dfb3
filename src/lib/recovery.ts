import { z } from "zod";
import type { MobilityDrill, MobilityRun } from "./mobility-practice.ts";
import { MOBILITY_SKILLS } from "./mobility-practice.ts";

const text = z.string().max(4000);
const nullableNumber = z.number().finite().min(0).max(100000).nullable();
export const recoveryExerciseSchema = z.object({
  id: z.string().min(1),
  exerciseId: z.string().nullable(),
  name: z.string().trim().min(1).max(200),
  sets: z.number().int().min(1).max(20),
  reps: text,
  weight: nullableNumber,
  hold: nullableNumber,
  side: z.enum(["none", "left", "right", "each"]),
  load: z.enum(["total", "per_hand", "bodyweight", "unloaded"]),
  setup: text,
  source: z
    .string()
    .refine((s) => !s || /^https?:\/\//i.test(s), "Use an http or https source link."),
});
export const recoveryTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  mode: z.enum(["quick", "measured"]),
  minutes: z.number().int().min(1).max(300),
  weekdays: z.array(z.number().int().min(0).max(6)),
  exercises: z.array(recoveryExerciseSchema).min(1).max(40),
  notes: text,
  nextMorning: z.boolean(),
  progression: text,
});
export const recoveryRoutineSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    purpose: z.enum(["", "Mobility", "Prehab", "Rehab"]),
    area: text,
    notes: text,
    status: z.enum(["active", "paused", "maintenance", "archived"]),
    templates: z.array(recoveryTemplateSchema).min(1).max(12),
  })
  .superRefine((r, ctx) => {
    if (new Set(r.templates.map((t) => t.id)).size !== r.templates.length)
      ctx.addIssue({ code: "custom", message: "Session identities must be unique." });
    for (const t of r.templates)
      if (new Set(t.exercises.map((e) => e.id)).size !== t.exercises.length)
        ctx.addIssue({ code: "custom", message: "Exercise identities must be unique." });
  });
export type RecoveryExercise = z.infer<typeof recoveryExerciseSchema>;
export type RecoveryTemplate = z.infer<typeof recoveryTemplateSchema>;
export type RecoveryRoutineInput = z.infer<typeof recoveryRoutineSchema>;
export type RecoveryRoutine = RecoveryRoutineInput & {
  id: string;
  person_id: string;
  version: number;
};
export const actualSchema = z.object({
  exerciseId: z.string(),
  side: z.enum(["none", "left", "right"]),
  set: z.number().int().min(1).max(20),
  reps: nullableNumber,
  weight: nullableNumber,
  hold: nullableNumber,
  range: text,
  technique: text,
});
export type RecoveryActual = z.infer<typeof actualSchema>;
export type RecoverySession = {
  id: string;
  person_id: string;
  routine_id: string | null;
  legacy_run_id: string | null;
  template_id: string;
  routine_name: string;
  session_date: string;
  status: "draft" | "completed" | "cancelled" | "skipped";
  snapshot: RecoveryTemplate;
  actuals: RecoveryActual[];
  pain: number | null;
  notes: string;
  response: "better" | "same" | "worse" | null;
  response_notes: string;
  check_enabled: boolean;
  version: number;
  completed_at: string | null;
  suggested_workout_id: string | null;
};
export type LegacyRecoverySchedule = {
  id: string;
  mobility_practice_run_id: string;
  suggested_for: string | null;
  title: string;
  status: string;
};
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function blankExercise(): RecoveryExercise {
  return {
    id: crypto.randomUUID(),
    exerciseId: null,
    name: "",
    sets: 1,
    reps: "",
    weight: null,
    hold: null,
    side: "none",
    load: "total",
    setup: "",
    source: "",
  };
}
export function blankTemplate(): RecoveryTemplate {
  return {
    id: crypto.randomUUID(),
    name: "Movement practice",
    mode: "quick",
    minutes: 5,
    weekdays: [],
    exercises: [blankExercise()],
    notes: "",
    nextMorning: false,
    progression: "",
  };
}
export function blankRoutine(): RecoveryRoutineInput {
  return {
    name: "",
    purpose: "",
    area: "",
    notes: "",
    status: "active",
    templates: [blankTemplate()],
  };
}
export function legacyTemplate(run: MobilityRun, drills: MobilityDrill[]): RecoveryTemplate {
  return {
    id: "legacy",
    name: "Practice",
    mode: "measured",
    minutes: 15,
    weekdays: [],
    notes: run.notes,
    nextMorning: false,
    progression: "",
    exercises: drills
      .filter((d) => d.runId === run.id && d.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((d) => ({
        id: d.id,
        exerciseId: d.exerciseId,
        name: d.name,
        sets: d.targetSets ?? 1,
        reps: d.targetReps,
        weight: d.targetWeightKg,
        hold: d.targetHoldSeconds,
        side: "none",
        load: "total",
        setup: d.targetDetail,
        source: d.lessonUrl,
      })),
  };
}
export function legacyName(run: MobilityRun) {
  return MOBILITY_SKILLS[run.skill].label;
}
export function emptyActuals(template: RecoveryTemplate): RecoveryActual[] {
  if (template.mode === "quick") return [];
  return template.exercises.flatMap((exercise) =>
    (exercise.side === "each" ? (["left", "right"] as const) : [exercise.side]).flatMap((side) =>
      Array.from({ length: exercise.sets }, (_, i) => ({
        exerciseId: exercise.id,
        side,
        set: i + 1,
        reps: null,
        weight: null,
        hold: null,
        range: "",
        technique: "",
      })),
    ),
  );
}
export function sessionMatches(s: RecoverySession, routineId: string, templateId: string) {
  return (
    (s.routine_id === routineId || s.legacy_run_id === routineId) && s.template_id === templateId
  );
}
export function templateDue(
  template: RecoveryTemplate,
  status: RecoveryRoutineInput["status"],
  routineId: string,
  sessions: RecoverySession[],
  date: string,
) {
  return (
    ["active", "maintenance"].includes(status) &&
    template.weekdays.includes(new Date(`${date}T12:00:00`).getDay()) &&
    !sessions.some(
      (s) =>
        sessionMatches(s, routineId, template.id) &&
        s.session_date === date &&
        ["completed", "skipped"].includes(s.status),
    )
  );
}
export function nextScheduledDate(template: RecoveryTemplate, date: string) {
  for (let day = 1; day <= 7; day++) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + day);
    if (template.weekdays.includes(next.getDay()))
      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  }
  return null;
}
export function comparableExercise(a: RecoveryExercise, b: RecoveryExercise) {
  return (
    a.id === b.id &&
    a.exerciseId === b.exerciseId &&
    a.load === b.load &&
    a.side === b.side &&
    a.setup === b.setup
  );
}
export function actualSummary(a: RecoveryActual, load: RecoveryExercise["load"]) {
  return [
    a.side !== "none" ? a.side : "",
    `set ${a.set}`,
    a.reps == null ? "" : `${a.reps} reps`,
    a.weight == null ? "" : `${a.weight} kg${load === "per_hand" ? "/hand" : ""}`,
    a.hold == null ? "" : `${a.hold}s`,
    a.range && `range: ${a.range}`,
    a.technique && `technique: ${a.technique}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
export function validateActuals(session: RecoverySession, actuals: RecoveryActual[]) {
  z.array(actualSchema).parse(actuals);
  const allowed = emptyActuals(session.snapshot);
  const keys = actuals.map((a) => `${a.exerciseId}:${a.side}:${a.set}`);
  if (
    new Set(keys).size !== keys.length ||
    actuals.some(
      (a) =>
        !allowed.some((b) => b.exerciseId === a.exerciseId && b.side === a.side && b.set === a.set),
    )
  )
    throw new Error("These results do not match this session.");
  return actuals.filter(
    (a) =>
      a.reps !== null ||
      a.weight !== null ||
      a.hold !== null ||
      a.range.trim() ||
      a.technique.trim(),
  );
}

export const recoveryDraftKey = (s: RecoverySession) => `tt:recovery:${s.person_id}:${s.id}`;

export function recoveryProgress(sessions: RecoverySession[]) {
  const groups = new Map<
    string,
    {
      name: string;
      load: RecoveryExercise["load"];
      side: string;
      setup: string;
      range: string;
      technique: string;
      rows: Array<{ date: string; actual: RecoveryActual; sessionId: string }>;
    }
  >();
  for (const session of sessions) {
    if (session.status !== "completed") continue;
    for (const actual of session.actuals) {
      const exercise = session.snapshot.exercises.find((e) => e.id === actual.exerciseId);
      if (!exercise) continue;
      const key = JSON.stringify([
        session.routine_id ?? session.legacy_run_id,
        exercise.id,
        exercise.exerciseId,
        exercise.load,
        actual.side,
        exercise.setup,
        actual.range,
        actual.technique,
      ]);
      const group = groups.get(key) ?? {
        name: exercise.name,
        load: exercise.load,
        side: actual.side,
        setup: exercise.setup,
        range: actual.range,
        technique: actual.technique,
        rows: [],
      };
      group.rows.push({ date: session.session_date, actual, sessionId: session.id });
      groups.set(key, group);
    }
  }
  return [...groups.entries()].map(([key, group]) => ({
    key,
    ...group,
    rows: group.rows.sort((a, b) => b.date.localeCompare(a.date) || a.actual.set - b.actual.set),
  }));
}
