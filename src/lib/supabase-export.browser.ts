import { supabasePublicSelect } from "./supabase-public";
import { getCurrentPerson } from "./supabase-people.browser";

type Row = Record<string, unknown>;

const PAGE_SIZE = 500;
const ID_BATCH_SIZE = 50;
const compositeOrder: Record<string, string> = {
  person_training_methods: "person_id.asc,training_method_id.asc",
  session_method_block_entries: "block_id.asc,session_entry_id.asc",
  suggested_workout_method_block_entries: "block_id.asc,suggested_workout_entry_id.asc",
};

async function allRows(table: string, params: Record<string, string>) {
  const rows: Row[] = [];
  // Continue until empty, including when the server applies a smaller row cap.
  for (;;) {
    const page = await supabasePublicSelect<Row>(table, {
      select: "*",
      ...params,
      order: compositeOrder[table] ?? "id.asc",
      limit: PAGE_SIZE,
      offset: rows.length,
    });
    if (!page.length) return rows;
    rows.push(...page);
  }
}

function ids(rows: Row[], column = "id") {
  return [
    ...new Set(
      rows.flatMap((row) =>
        typeof row[column] === "string" && row[column] ? [row[column] as string] : [],
      ),
    ),
  ];
}

async function owned(table: string, personId: string, column = "person_id") {
  return allRows(table, { [column]: `eq.${personId}` });
}

async function children(table: string, column: string, parentIds: string[]) {
  const rows: Row[] = [];
  for (let i = 0; i < parentIds.length; i += ID_BATCH_SIZE) {
    rows.push(
      ...(await allRows(table, {
        [column]: `in.(${parentIds.slice(i, i + ID_BATCH_SIZE).join(",")})`,
      })),
    );
  }
  return rows;
}

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvValue(value: unknown) {
  const text =
    value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function getPersonalDataExport() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("This account is not linked to a training profile.");
  const [
    people,
    sessions,
    oneRmTests,
    bodyweightLogs,
    goals,
    goalCheckins,
    rotationItems,
    rotationAssignments,
    locations,
    equipment,
    personExercises,
    programmeAssignments,
    suggestedWorkouts,
    personMethods,
    qualityBatches,
    qualityEvents,
    programs,
  ] = await Promise.all([
    owned("people", person.id, "id"),
    owned("sessions", person.id),
    owned("one_rm_tests", person.id),
    owned("bodyweight_logs", person.id),
    owned("goals", person.id),
    owned("goal_checkins", person.id),
    owned("daily_rotation_items", person.id),
    owned("daily_rotation_assignments", person.id),
    owned("training_locations", person.id),
    owned("equipment_items", person.id),
    owned("person_exercises", person.id),
    owned("program_assignments", person.id),
    owned("suggested_workouts", person.id),
    owned("person_training_methods", person.id),
    owned("data_quality_batches", person.id),
    owned("data_quality_audit_events", person.id),
    owned("programs", person.id, "created_by_person_id"),
  ]);
  const sessionIds = ids(sessions);
  const assignmentIds = ids(programmeAssignments);
  const suggestionIds = ids(suggestedWorkouts);
  const programIds = [...new Set([...ids(programs), ...ids(programmeAssignments, "program_id")])];
  const referencedPrograms = await children("programs", "id", programIds);
  const exportedPrograms = [
    ...new Map([...programs, ...referencedPrograms].map((row) => [row.id, row])).values(),
  ];
  const [
    entries,
    sessionBlocks,
    programWorkouts,
    assignmentExercises,
    assignmentPools,
    programReviews,
    suggestedEntries,
    suggestedBlocks,
  ] = await Promise.all([
    children("session_entries", "session_id", sessionIds),
    children("session_method_blocks", "session_id", sessionIds),
    children("program_workouts", "program_id", programIds),
    children("program_assignment_exercises", "program_assignment_id", assignmentIds),
    children("program_assignment_exercise_pools", "program_assignment_id", assignmentIds),
    children("program_workout_reviews", "program_assignment_id", assignmentIds),
    children("suggested_workout_entries", "suggested_workout_id", suggestionIds),
    children("suggested_workout_method_blocks", "suggested_workout_id", suggestionIds),
  ]);
  const [
    sessionSets,
    sessionMetrics,
    blockEntries,
    programEntries,
    suggestedSets,
    suggestedBlockEntries,
  ] = await Promise.all([
    children("entry_sets", "session_entry_id", ids(entries)),
    children("entry_metrics", "session_entry_id", ids(entries)),
    children("session_method_block_entries", "block_id", ids(sessionBlocks)),
    children("program_workout_entries", "program_workout_id", ids(programWorkouts)),
    children("suggested_workout_sets", "suggested_workout_entry_id", ids(suggestedEntries)),
    children("suggested_workout_method_block_entries", "block_id", ids(suggestedBlocks)),
  ]);
  const [sessionSegments, suggestedSetSegments] = await Promise.all([
    children("entry_set_segments", "entry_set_id", ids(sessionSets)),
    children("suggested_workout_set_segments", "suggested_workout_set_id", ids(suggestedSets)),
  ]);
  return {
    exported_at: new Date().toISOString(),
    person_id: person.id,
    sessions,
    session_entries: entries,
    entry_sets: sessionSets,
    entry_set_segments: sessionSegments,
    entry_metrics: sessionMetrics,
    session_method_blocks: sessionBlocks,
    session_method_block_entries: blockEntries,
    one_rm_tests: oneRmTests,
    bodyweight_logs: bodyweightLogs,
    goals,
    goal_checkins: goalCheckins,
    daily_rotation_items: rotationItems,
    daily_rotation_assignments: rotationAssignments,
    programs: exportedPrograms,
    program_workouts: programWorkouts,
    program_workout_entries: programEntries,
    program_assignments: programmeAssignments,
    program_assignment_exercises: assignmentExercises,
    program_assignment_exercise_pools: assignmentPools,
    program_workout_reviews: programReviews,
    suggested_workouts: suggestedWorkouts,
    suggested_workout_entries: suggestedEntries,
    suggested_workout_sets: suggestedSets,
    suggested_workout_set_segments: suggestedSetSegments,
    suggested_workout_method_blocks: suggestedBlocks,
    suggested_workout_method_block_entries: suggestedBlockEntries,
    training_locations: locations,
    equipment_items: equipment,
    person_exercises: personExercises,
    person_training_methods: personMethods,
    data_quality_batches: qualityBatches,
    data_quality_audit_events: qualityEvents,
    people,
  };
}

const CSV_HEADERS = [
  "session_date",
  "session_title",
  "session_id",
  "entry_id",
  "entry_name",
  "set_number",
  "reps",
  "weight",
  "duration_seconds",
  "distance",
  "distance_unit",
  "rpe",
  "completed",
  "duration_minutes",
  "session_completed",
  "entry_completed",
  "notes",
];

export function serializeSessionCsv(
  data: Pick<
    Awaited<ReturnType<typeof getPersonalDataExport>>,
    "sessions" | "session_entries" | "entry_sets"
  >,
) {
  const sessionById = new Map(data.sessions.map((session) => [session.id, session]));
  const setsByEntry = new Map<unknown, Row[]>();
  for (const set of data.entry_sets) {
    const rows = setsByEntry.get(set.session_entry_id) ?? [];
    rows.push(set);
    setsByEntry.set(set.session_entry_id, rows);
  }
  const sessionsWithEntries = new Set(data.session_entries.map((entry) => entry.session_id));
  const records = data.session_entries.flatMap((entry) =>
    (setsByEntry.get(entry.id) ?? [{}]).map((set) => ({
      session: sessionById.get(entry.session_id),
      entry,
      set,
    })),
  );
  // Preserve setless activities and sessions without entries in a sessions CSV.
  for (const session of data.sessions) {
    if (!sessionsWithEntries.has(session.id)) records.push({ session, entry: {}, set: {} });
  }
  const rows = records.map(({ session, entry, set }) => ({
    session_date: session?.session_date,
    session_title: session?.title,
    session_id: session?.id,
    entry_id: entry.id,
    entry_name: entry.name,
    set_number: set.set_number,
    reps: set.reps,
    weight: set.weight,
    duration_seconds: set.duration_seconds,
    distance: set.distance,
    distance_unit: set.distance_unit,
    rpe: set.rpe ?? session?.rpe,
    completed: set.completed ?? entry.completed ?? session?.completed,
    duration_minutes: session?.duration_minutes,
    session_completed: session?.completed,
    entry_completed: entry.completed,
    notes: entry.notes ?? session?.notes,
  }));
  return [
    CSV_HEADERS,
    ...rows.map((row) => CSV_HEADERS.map((header) => row[header as keyof typeof row])),
  ]
    .map((row) => row.map(csvValue).join(","))
    .join("\n");
}

export async function downloadPersonalData(format: "json" | "csv") {
  const data = await getPersonalDataExport();
  const date = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    download(`training-data-${date}.json`, JSON.stringify(data, null, 2), "application/json");
    return;
  }
  download(`training-sessions-${date}.csv`, serializeSessionCsv(data), "text/csv;charset=utf-8");
}
