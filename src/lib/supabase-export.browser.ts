import {
  makeProfileBackup,
  PROFILE_BACKUP_TABLES,
  type ProfileBackupData,
  type BackupTable,
} from "./profile-backup";
import { supabasePublicSelect } from "./supabase-public";
import { getCurrentPerson } from "./supabase-people.browser";

type Row = Record<string, unknown>;

const PAGE_SIZE = 500;
const ID_BATCH_SIZE = 50;
const compositeOrder: Record<string, string> = {
  person_training_methods: "person_id.asc,training_method_id.asc",
  coaching_preferences: "person_id.asc",
  personal_programmes: "assignment_id.asc",
  personal_programme_sessions: "assignment_id.asc,program_workout_id.asc",
  programme_session_dates: "assignment_id.asc,program_workout_id.asc",
  person_exercise_toolkit_lessons: "person_id.asc,exercise_id.asc,skill.asc",
  exercise_equipment_items: "exercise_id.asc,equipment_item_id.asc",
  exercise_tag_links: "exercise_id.asc,tag_id.asc",
  training_location_equipment: "location_id.asc,equipment_item_id.asc",
  session_method_block_entries: "block_id.asc,session_entry_id.asc",
  suggested_workout_method_block_entries: "block_id.asc,suggested_workout_entry_id.asc",
};

async function allRows(table: string, params: Record<string, string>) {
  const rows: Row[] = [];
  // Continue until empty, including when the server applies a smaller row cap.
  for (;;) {
    const page = await supabasePublicSelect<Row>(
      table,
      {
        select: "*",
        ...params,
        order: compositeOrder[table] ?? "id.asc",
        limit: PAGE_SIZE,
        offset: rows.length,
      },
      { cache: "no-store" },
    );
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

async function captureProfileData(personId: string) {
  const data = {} as ProfileBackupData;
  for (const table of PROFILE_BACKUP_TABLES) data[table] = [];
  const ownedTables: Partial<Record<BackupTable, string>> = {
    people: "id",
    programs: "created_by_person_id",
    sessions: "person_id",
    one_rm_tests: "person_id",
    bodyweight_logs: "person_id",
    goals: "person_id",
    goal_checkins: "person_id",
    daily_rotation_items: "person_id",
    daily_rotation_assignments: "person_id",
    training_locations: "person_id",
    equipment_items: "person_id",
    person_exercises: "person_id",
    program_assignments: "person_id",
    suggested_workouts: "person_id",
    person_training_methods: "person_id",
    data_quality_batches: "person_id",
    data_quality_audit_events: "person_id",
    coaching_preferences: "person_id",
    coaching_recommendation_decisions: "person_id",
    mobility_practice_runs: "person_id",
    kettlebell_workouts: "person_id",
    person_app_profiles: "person_id",
    person_exercise_toolkit_lessons: "person_id",
    training_methods: "person_id",
    programme_strength_week_reviews: "person_id",
  };
  await Promise.all(
    Object.entries(ownedTables).map(async ([table, column]) => {
      data[table as BackupTable] = await owned(table, personId, column);
    }),
  );
  const load = async (table: BackupTable, column: string, parents: Row[], parentColumn = "id") => {
    data[table] = await children(table, column, ids(parents, parentColumn));
  };
  await Promise.all([
    load("session_entries", "session_id", data.sessions),
    load("session_method_blocks", "session_id", data.sessions),
    load("program_assignment_exercises", "program_assignment_id", data.program_assignments),
    load("program_assignment_exercise_pools", "program_assignment_id", data.program_assignments),
    load("program_workout_reviews", "program_assignment_id", data.program_assignments),
    load("personal_programmes", "assignment_id", data.program_assignments),
    load("personal_programme_sessions", "assignment_id", data.program_assignments),
    load("programme_session_dates", "assignment_id", data.program_assignments),
    load("suggested_workout_entries", "suggested_workout_id", data.suggested_workouts),
    load("suggested_workout_method_blocks", "suggested_workout_id", data.suggested_workouts),
    load("coaching_recommendation_outcomes", "decision_id", data.coaching_recommendation_decisions),
    load("mobility_practice_drills", "run_id", data.mobility_practice_runs),
    load("mobility_assessment_results", "run_id", data.mobility_practice_runs),
    load("training_location_equipment", "location_id", data.training_locations),
    load("exercise_equipment_items", "equipment_item_id", data.equipment_items),
    load("app_profiles", "id", data.person_app_profiles, "app_profile_id"),
  ]);
  const merge = (left: Row[], right: Row[]) => [
    ...new Map([...left, ...right].map((row) => [row.id, row])).values(),
  ];
  const programmeIds = [
    ...new Set([...ids(data.programs), ...ids(data.program_assignments, "program_id")]),
  ];
  const referencedWorkouts = [
    ...new Set([
      ...ids(data.suggested_workouts, "program_workout_id"),
      ...ids(data.program_workout_reviews, "program_workout_id"),
      ...ids(data.personal_programme_sessions, "program_workout_id"),
    ]),
  ];
  const [programmeWorkouts, linkedWorkouts] = await Promise.all([
    children("program_workouts", "program_id", programmeIds),
    children("program_workouts", "id", referencedWorkouts),
  ]);
  data.program_workouts = merge(programmeWorkouts, linkedWorkouts);
  data.programs = merge(
    data.programs,
    await children("programs", "id", [
      ...new Set([...programmeIds, ...ids(data.program_workouts, "program_id")]),
    ]),
  );
  await Promise.all([
    load("entry_sets", "session_entry_id", data.session_entries),
    load("entry_metrics", "session_entry_id", data.session_entries),
    load("session_method_block_entries", "block_id", data.session_method_blocks),
    load("program_workout_entries", "program_workout_id", data.program_workouts),
    load("suggested_workout_sets", "suggested_workout_entry_id", data.suggested_workout_entries),
    load(
      "suggested_workout_method_block_entries",
      "block_id",
      data.suggested_workout_method_blocks,
    ),
  ]);
  await Promise.all([
    load("entry_set_segments", "entry_set_id", data.entry_sets),
    load("suggested_workout_set_segments", "suggested_workout_set_id", data.suggested_workout_sets),
  ]);
  // Saved plans/reviews/collections also keep identifiers inside JSON. Include
  // those catalogue references, including exercises no longer enabled locally.
  const references = new Set<string>();
  const visit = (value: unknown): void => {
    if (
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    )
      references.add(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  Object.values(data).forEach(visit);
  const exerciseIds = [
    ...new Set([...references, ...Object.values(data).flatMap((rows) => ids(rows, "exercise_id"))]),
  ];
  data.exercises = await children("exercises", "id", exerciseIds);
  data.training_methods = merge(
    data.training_methods,
    await children("training_methods", "id", [
      ...new Set([
        ...references,
        ...Object.values(data).flatMap((rows) => ids(rows, "training_method_id")),
      ]),
    ]),
  );
  await Promise.all([
    load("exercise_activity_types", "exercise_id", data.exercises),
    load("exercise_tag_links", "exercise_id", data.exercises),
    load("exercise_aliases", "exercise_id", data.exercises),
  ]);
  await Promise.all([
    load("exercise_tags", "id", data.exercise_tag_links, "tag_id"),
    load(
      "activity_types",
      "id",
      [
        ...data.exercises,
        ...data.session_entries,
        ...data.sessions,
        ...data.exercise_activity_types,
        ...data.exercise_aliases,
      ],
      "activity_type_id",
    ),
  ]);
  return data;
}

export async function getPersonalDataExport() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("This account is not linked to a training profile.");
  const first = await captureProfileData(person.id);
  const confirmed = await captureProfileData(person.id);
  // Multiple REST reads are not a database snapshot. Require two matching
  // complete reads so background sync or edits cannot yield a mixed backup.
  if (JSON.stringify(first) !== JSON.stringify(confirmed)) {
    throw new Error(
      "Training data or setup changed during the backup. Finish syncing or editing, then retry.",
    );
  }
  return makeProfileBackup(confirmed, person.id);
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

async function getSessionCsvData() {
  const person = await getCurrentPerson();
  if (!person) throw new Error("This account is not linked to a training profile.");
  const sessions = await owned("sessions", person.id);
  const session_entries = await children("session_entries", "session_id", ids(sessions));
  const entry_sets = await children("entry_sets", "session_entry_id", ids(session_entries));
  return { sessions, session_entries, entry_sets };
}

export async function downloadPersonalData(format: "json" | "csv") {
  const date = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    const data = await getPersonalDataExport();
    download(`training-data-${date}.json`, JSON.stringify(data, null, 2), "application/json");
    return;
  }
  const data = await getSessionCsvData();
  download(`training-sessions-${date}.csv`, serializeSessionCsv(data), "text/csv;charset=utf-8");
}
