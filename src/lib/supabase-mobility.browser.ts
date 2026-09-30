import {
  supabasePublicDelete,
  supabasePublicInsert,
  supabasePublicSelect,
  supabasePublicUpdate,
} from "./supabase-public";
import { getCurrentPerson } from "./supabase-people.browser";
import { todayISO } from "./date";
import {
  isToolkitLessonUrl,
  MOBILITY_SKILLS,
  type BridgeReadiness,
  type MobilityAssessment,
  type MobilityDrill,
  type MobilityPhase,
  type MobilityRun,
  type MobilityRunStatus,
  type MobilitySession,
  type MobilitySkill,
} from "./mobility-practice";

type RunRow = {
  id: string;
  person_id: string;
  skill: MobilitySkill;
  status: MobilityRunStatus;
  phase: MobilityPhase;
  started_on: string;
  ended_on: string | null;
  review_on: string | null;
  readiness: BridgeReadiness;
  readiness_checked_on: string | null;
  readiness_left_deg: number | null;
  readiness_right_deg: number | null;
  plan_received: boolean;
  notes: string | null;
};

type AssessmentRow = {
  id: string;
  run_id: string;
  test_key: string;
  side: MobilityAssessment["side"];
  measured_on: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: MobilityAssessment["unit"];
  setup_note: string | null;
};

type DrillRow = {
  id: string;
  run_id: string;
  exercise_id: string | null;
  name: string;
  lesson_url: string | null;
  sort_order: number;
  target_sets: number | null;
  target_reps: string | null;
  target_weight_kg: number | null;
  target_hold_seconds: number | null;
  target_detail: string | null;
  is_active: boolean;
};

type SessionRow = {
  id: string;
  mobility_practice_run_id: string;
  session_date: string;
  title: string | null;
};

function mapRun(row: RunRow): MobilityRun {
  return {
    id: row.id,
    personId: row.person_id,
    skill: row.skill,
    status: row.status,
    phase: row.phase,
    startedOn: row.started_on,
    endedOn: row.ended_on,
    reviewOn: row.review_on,
    readiness: row.readiness,
    readinessCheckedOn: row.readiness_checked_on,
    readinessLeftDeg: row.readiness_left_deg,
    readinessRightDeg: row.readiness_right_deg,
    planReceived: row.plan_received,
    notes: row.notes ?? "",
  };
}

function mapAssessment(row: AssessmentRow): MobilityAssessment {
  return {
    id: row.id,
    runId: row.run_id,
    testKey: row.test_key,
    side: row.side,
    measuredOn: row.measured_on,
    valueNumeric: row.value_numeric,
    valueText: row.value_text ?? "",
    unit: row.unit,
    setupNote: row.setup_note ?? "",
  };
}

function mapDrill(row: DrillRow): MobilityDrill {
  return {
    id: row.id,
    runId: row.run_id,
    exerciseId: row.exercise_id,
    name: row.name,
    lessonUrl: row.lesson_url ?? "",
    sortOrder: row.sort_order,
    targetSets: row.target_sets,
    targetReps: row.target_reps ?? "",
    targetWeightKg: row.target_weight_kg,
    targetHoldSeconds: row.target_hold_seconds,
    targetDetail: row.target_detail ?? "",
    isActive: row.is_active,
  };
}

async function requirePerson() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("Connect your training profile first.");
  return person;
}

export async function listMobilityDataClient() {
  const person = await requirePerson();
  const runs = await supabasePublicSelect<RunRow>("mobility_practice_runs", {
    select:
      "id,person_id,skill,status,phase,started_on,ended_on,review_on,readiness,readiness_checked_on,readiness_left_deg,readiness_right_deg,plan_received,notes",
    person_id: `eq.${person.id}`,
    order: "started_on.desc,created_at.desc",
  });
  if (!runs.length) {
    return {
      runs: [] as MobilityRun[],
      assessments: [] as MobilityAssessment[],
      drills: [] as MobilityDrill[],
      sessions: [] as MobilitySession[],
    };
  }
  const ids = `in.(${runs.map((run) => run.id).join(",")})`;
  const [assessments, drills, sessions] = await Promise.all([
    supabasePublicSelect<AssessmentRow>("mobility_assessment_results", {
      select: "id,run_id,test_key,side,measured_on,value_numeric,value_text,unit,setup_note",
      run_id: ids,
      order: "measured_on.desc,created_at.desc",
    }),
    supabasePublicSelect<DrillRow>("mobility_practice_drills", {
      select:
        "id,run_id,exercise_id,name,lesson_url,sort_order,target_sets,target_reps,target_weight_kg,target_hold_seconds,target_detail,is_active",
      run_id: ids,
      order: "sort_order.asc,created_at.asc",
    }),
    supabasePublicSelect<SessionRow>("sessions", {
      select: "id,mobility_practice_run_id,session_date,title",
      person_id: `eq.${person.id}`,
      mobility_practice_run_id: ids,
      order: "session_date.desc,created_at.desc",
    }),
  ]);
  return {
    runs: runs.map(mapRun),
    assessments: assessments.map(mapAssessment),
    drills: drills.map(mapDrill),
    sessions: sessions.map((row) => ({
      id: row.id,
      runId: row.mobility_practice_run_id,
      date: row.session_date,
      title: row.title ?? "Mobility practice",
    })),
  };
}

export async function startMobilityRunClient(skill: MobilitySkill) {
  const person = await requirePerson();
  const rows = await supabasePublicInsert<RunRow>("mobility_practice_runs", {
    person_id: person.id,
    skill,
    status: "active",
    phase: "setup",
    started_on: todayISO(),
  });
  if (!rows[0]) throw new Error("The practice could not be started.");
  return mapRun(rows[0]);
}

export async function setMobilityRunStatusClient(id: string, status: MobilityRunStatus) {
  const person = await requirePerson();
  const rows = await supabasePublicUpdate<RunRow>(
    "mobility_practice_runs",
    { id: `eq.${id}`, person_id: `eq.${person.id}` },
    { status, ended_on: status === "archived" ? todayISO() : null },
  );
  if (!rows[0]) throw new Error("The practice could not be updated.");
  return mapRun(rows[0]);
}

export async function updateMobilityRunClient(
  id: string,
  fields: {
    phase?: MobilityPhase;
    reviewOn?: string | null;
    planReceived?: boolean;
    notes?: string;
    readiness?: BridgeReadiness;
    readinessCheckedOn?: string | null;
    readinessLeftDeg?: number | null;
    readinessRightDeg?: number | null;
  },
) {
  const person = await requirePerson();
  const body: Record<string, unknown> = {};
  if (fields.phase !== undefined) body.phase = fields.phase;
  if (fields.reviewOn !== undefined) body.review_on = fields.reviewOn;
  if (fields.planReceived !== undefined) body.plan_received = fields.planReceived;
  if (fields.notes !== undefined) body.notes = fields.notes.trim() || null;
  if (fields.readiness !== undefined) body.readiness = fields.readiness;
  if (fields.readinessCheckedOn !== undefined)
    body.readiness_checked_on = fields.readinessCheckedOn;
  if (fields.readinessLeftDeg !== undefined) body.readiness_left_deg = fields.readinessLeftDeg;
  if (fields.readinessRightDeg !== undefined) body.readiness_right_deg = fields.readinessRightDeg;
  const rows = await supabasePublicUpdate<RunRow>(
    "mobility_practice_runs",
    { id: `eq.${id}`, person_id: `eq.${person.id}` },
    body,
  );
  if (!rows[0]) throw new Error("The practice could not be updated.");
  return mapRun(rows[0]);
}

export async function saveMobilityAssessmentClient(input: {
  id?: string;
  runId: string;
  skill: MobilitySkill;
  testKey: string;
  side: MobilityAssessment["side"];
  measuredOn: string;
  valueNumeric: number | null;
  valueText: string;
  unit: MobilityAssessment["unit"];
  setupNote: string;
}) {
  await requirePerson();
  if (!MOBILITY_SKILLS[input.skill].tests.some((test) => test.key === input.testKey)) {
    throw new Error("Choose an assessment test from this skill.");
  }
  if (!input.measuredOn) throw new Error("Choose an assessment date.");
  if (input.unit === "text" ? !input.valueText.trim() : input.valueNumeric == null) {
    throw new Error("Enter an assessment result.");
  }
  if (input.unit !== "text" && !Number.isFinite(input.valueNumeric)) {
    throw new Error("Enter a valid number.");
  }
  const body = {
    run_id: input.runId,
    test_key: input.testKey,
    side: input.side,
    measured_on: input.measuredOn,
    value_numeric: input.unit === "text" ? null : input.valueNumeric,
    value_text: input.unit === "text" ? input.valueText.trim() : null,
    unit: input.unit,
    setup_note: input.setupNote.trim() || null,
  };
  const rows = input.id
    ? await supabasePublicUpdate<AssessmentRow>(
        "mobility_assessment_results",
        { id: `eq.${input.id}`, run_id: `eq.${input.runId}` },
        body,
      )
    : await supabasePublicInsert<AssessmentRow>("mobility_assessment_results", body);
  if (!rows[0]) throw new Error("The assessment result could not be saved.");
  return mapAssessment(rows[0]);
}

export async function deleteMobilityAssessmentClient(id: string, runId: string) {
  await requirePerson();
  const rows = await supabasePublicDelete<{ id: string }>("mobility_assessment_results", {
    id: `eq.${id}`,
    run_id: `eq.${runId}`,
  });
  if (!rows[0]) throw new Error("The assessment result could not be removed.");
}

export async function saveMobilityDrillClient(input: {
  id?: string;
  runId: string;
  exerciseId: string | null;
  name: string;
  lessonUrl: string;
  sortOrder: number;
  targetSets: number | null;
  targetReps: string;
  targetWeightKg: number | null;
  targetHoldSeconds: number | null;
  targetDetail: string;
  isActive: boolean;
}) {
  await requirePerson();
  if (!input.name.trim()) throw new Error("Name the drill.");
  if (input.lessonUrl.trim() && !isToolkitLessonUrl(input.lessonUrl.trim())) {
    throw new Error("Use a lesson link from the Mobility & Flexibility Toolkit.");
  }
  const body = {
    run_id: input.runId,
    exercise_id: input.exerciseId,
    name: input.name.trim(),
    lesson_url: input.lessonUrl.trim() || null,
    sort_order: input.sortOrder,
    target_sets: input.targetSets,
    target_reps: input.targetReps.trim() || null,
    target_weight_kg: input.targetWeightKg,
    target_hold_seconds: input.targetHoldSeconds,
    target_detail: input.targetDetail.trim() || null,
    is_active: input.isActive,
  };
  const rows = input.id
    ? await supabasePublicUpdate<DrillRow>(
        "mobility_practice_drills",
        { id: `eq.${input.id}`, run_id: `eq.${input.runId}` },
        body,
      )
    : await supabasePublicInsert<DrillRow>("mobility_practice_drills", body);
  if (!rows[0]) throw new Error("The drill could not be saved.");
  return mapDrill(rows[0]);
}

export async function deleteMobilityDrillClient(id: string, runId: string) {
  await requirePerson();
  const rows = await supabasePublicDelete<{ id: string }>("mobility_practice_drills", {
    id: `eq.${id}`,
    run_id: `eq.${runId}`,
  });
  if (!rows[0]) throw new Error("The drill could not be removed.");
}
