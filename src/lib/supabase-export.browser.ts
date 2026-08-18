import { supabasePublicSelect } from "./supabase-public";
import { getCurrentPerson } from "./supabase-people.browser";

type Row = Record<string, unknown>;

async function owned(table: string, personId: string, column = "person_id") {
  return supabasePublicSelect<Row>(table, {
    select: "*",
    [column]: `eq.${personId}`,
    limit: 10000,
  });
}

async function linked(table: string, params: Record<string, string>) {
  return supabasePublicSelect<Row>(table, { select: "*", ...params, limit: 10000 });
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
  const sessionIds = sessions.map((row) => String(row.id));
  const assignmentIds = programmeAssignments.map((row) => String(row.id));
  const suggestionIds = suggestedWorkouts.map((row) => String(row.id));
  const programIds = Array.from(
    new Set(
      [...programs, ...programmeAssignments].map((row) => String(row.program_id)).filter(Boolean),
    ),
  );
  const [
    entries,
    sessionSets,
    sessionMetrics,
    sessionBlocks,
    blockEntries,
    programWorkouts,
    assignmentExercises,
    assignmentPools,
    programReviews,
    suggestedEntries,
    suggestedSets,
    suggestedBlocks,
  ] = await Promise.all([
    sessionIds.length
      ? linked("session_entries", { "sessions!inner.person_id": `eq.${person.id}` })
      : Promise.resolve([]),
    sessionIds.length
      ? linked("entry_sets", {
          "session_entries!inner.sessions!inner.person_id": `eq.${person.id}`,
        })
      : Promise.resolve([]),
    sessionIds.length
      ? linked("entry_metrics", {
          "session_entries!inner.sessions!inner.person_id": `eq.${person.id}`,
        })
      : Promise.resolve([]),
    sessionIds.length
      ? linked("session_method_blocks", { "sessions!inner.person_id": `eq.${person.id}` })
      : Promise.resolve([]),
    sessionIds.length
      ? linked("session_method_block_entries", {
          "session_method_blocks!inner.sessions!inner.person_id": `eq.${person.id}`,
        })
      : Promise.resolve([]),
    programIds.length
      ? linked("program_workouts", { program_id: `in.(${programIds.join(",")})` })
      : Promise.resolve([]),
    assignmentIds.length
      ? linked("program_assignment_exercises", {
          program_assignment_id: `in.(${assignmentIds.join(",")})`,
        })
      : Promise.resolve([]),
    assignmentIds.length
      ? linked("program_assignment_exercise_pools", {
          program_assignment_id: `in.(${assignmentIds.join(",")})`,
        })
      : Promise.resolve([]),
    assignmentIds.length
      ? linked("program_workout_reviews", {
          program_assignment_id: `in.(${assignmentIds.join(",")})`,
        })
      : Promise.resolve([]),
    suggestionIds.length
      ? linked("suggested_workout_entries", {
          suggested_workout_id: `in.(${suggestionIds.join(",")})`,
        })
      : Promise.resolve([]),
    suggestionIds.length
      ? linked("suggested_workout_sets", {
          "suggested_workout_entries!inner.suggested_workout_id": `in.(${suggestionIds.join(",")})`,
        })
      : Promise.resolve([]),
    suggestionIds.length
      ? linked("suggested_workout_method_blocks", {
          suggested_workout_id: `in.(${suggestionIds.join(",")})`,
        })
      : Promise.resolve([]),
  ]);
  const suggestedEntryIds = suggestedEntries.map((row) => String(row.id));
  const suggestedMethodBlocks = suggestedBlocks;
  const suggestedBlockIds = suggestedMethodBlocks.map((row) => String(row.id));
  const [programEntries, suggestedSetSegments, suggestedBlockEntries] = await Promise.all([
    programWorkouts.length
      ? linked("program_workout_entries", {
          program_workout_id: `in.(${programWorkouts.map((row) => String(row.id)).join(",")})`,
        })
      : Promise.resolve([]),
    suggestedEntryIds.length
      ? linked("suggested_workout_set_segments", {
          "suggested_workout_sets!inner.suggested_workout_entries!inner.suggested_workout_id": `in.(${suggestionIds.join(",")})`,
        })
      : Promise.resolve([]),
    suggestedBlockIds.length
      ? linked("suggested_workout_method_block_entries", {
          block_id: `in.(${suggestedBlockIds.join(",")})`,
        })
      : Promise.resolve([]),
  ]);
  return {
    exported_at: new Date().toISOString(),
    person_id: person.id,
    sessions,
    session_entries: entries,
    entry_sets: sessionSets,
    entry_set_segments: await linked("entry_set_segments", {
      "entry_sets!inner.session_entries!inner.sessions!inner.person_id": `eq.${person.id}`,
    }),
    entry_metrics: sessionMetrics,
    session_method_blocks: sessionBlocks,
    session_method_block_entries: blockEntries,
    one_rm_tests: oneRmTests,
    bodyweight_logs: bodyweightLogs,
    goals,
    goal_checkins: goalCheckins,
    daily_rotation_items: rotationItems,
    daily_rotation_assignments: rotationAssignments,
    programs,
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

export async function downloadPersonalData(format: "json" | "csv") {
  const data = await getPersonalDataExport();
  if (format === "json") {
    download(
      `training-data-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
    return;
  }
  const entryById = new Map(data.session_entries.map((entry) => [String(entry.id), entry]));
  const sessionById = new Map(data.sessions.map((session) => [String(session.id), session]));
  const rows = data.entry_sets.map((set) => {
    const entry = entryById.get(String(set.session_entry_id));
    const session = entry ? sessionById.get(String(entry.session_id)) : undefined;
    return {
      session_date: session?.session_date,
      session_title: session?.title,
      session_id: session?.id,
      entry_id: entry?.id,
      entry_name: entry?.name,
      set_number: set.set_number,
      reps: set.reps,
      weight: set.weight,
      duration_seconds: set.duration_seconds,
      distance: set.distance,
      distance_unit: set.distance_unit,
      rpe: set.rpe,
      completed: set.completed,
    };
  });
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csv = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header as keyof typeof row])),
  ]
    .map((row) => row.map(csvValue).join(","))
    .join("\n");
  download(
    `training-sessions-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
    "text/csv;charset=utf-8",
  );
}
