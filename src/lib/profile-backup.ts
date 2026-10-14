import { PROFILE_BACKUP_RELATIONS } from "./profile-backup-relations.ts";
export type BackupRow = Record<string, unknown>;
export const PROFILE_BACKUP_TABLES = [
  "people",
  "app_profiles",
  "person_app_profiles",
  "activity_types",
  "exercises",
  "exercise_aliases",
  "exercise_activity_types",
  "exercise_tags",
  "exercise_tag_links",
  "person_exercises",
  "person_exercise_toolkit_lessons",
  "training_locations",
  "equipment_items",
  "exercise_equipment_items",
  "training_location_equipment",
  "training_methods",
  "person_training_methods",
  "bodyweight_logs",
  "one_rm_tests",
  "goals",
  "goal_checkins",
  "daily_rotation_items",
  "daily_rotation_assignments",
  "data_quality_batches",
  "data_quality_audit_events",
  "programs",
  "program_workouts",
  "program_workout_entries",
  "program_assignments",
  "program_assignment_exercises",
  "program_assignment_exercise_pools",
  "personal_programmes",
  "personal_programme_sessions",
  "programme_session_dates",
  "programme_strength_week_reviews",
  "program_workout_reviews",
  "coaching_preferences",
  "coaching_recommendation_decisions",
  "coaching_recommendation_outcomes",
  "mobility_practice_runs",
  "mobility_practice_drills",
  "mobility_assessment_results",
  "kettlebell_workouts",
  "sessions",
  "session_entries",
  "entry_sets",
  "entry_set_segments",
  "entry_metrics",
  "session_method_blocks",
  "session_method_block_entries",
  "suggested_workouts",
  "suggested_workout_entries",
  "suggested_workout_sets",
  "suggested_workout_set_segments",
  "suggested_workout_method_blocks",
  "suggested_workout_method_block_entries",
] as const;
export type BackupTable = (typeof PROFILE_BACKUP_TABLES)[number];
export type ProfileBackupData = Record<BackupTable, BackupRow[]>;
export type ProfileBackup = ProfileBackupData & {
  backup_type: "train-track-profile";
  schema_version: 1 | 2;
  exported_at: string;
  person_id: string;
  backup_manifest: {
    table_counts: Record<BackupTable, number>;
    external_people_ids: string[];
    excluded: string[];
  };
};
const primaryKeys: Partial<Record<BackupTable, string[]>> = {
  coaching_preferences: ["person_id"],
  person_training_methods: ["person_id", "training_method_id"],
  personal_programmes: ["assignment_id"],
  personal_programme_sessions: ["assignment_id", "program_workout_id"],
  programme_session_dates: ["assignment_id", "program_workout_id"],
  person_exercise_toolkit_lessons: ["person_id", "exercise_id", "skill"],
  exercise_equipment_items: ["exercise_id", "equipment_item_id"],
  exercise_tag_links: ["exercise_id", "tag_id"],
  training_location_equipment: ["location_id", "equipment_item_id"],
  session_method_block_entries: ["block_id", "session_entry_id"],
  suggested_workout_method_block_entries: ["block_id", "suggested_workout_entry_id"],
};
const actorColumns = new Set([
  "programs.created_by_person_id",
  "program_assignments.assigned_by_person_id",
  "exercise_aliases.reviewed_by",
  "data_quality_batches.created_by",
]);
export function makeProfileBackup(data: ProfileBackupData, personId: string): ProfileBackup {
  const externalPeople = new Set<string>();
  for (const table of PROFILE_BACKUP_TABLES) {
    const keys = primaryKeys[table] ?? ["id"];
    const seen = new Set<string>();
    for (const row of data[table]) {
      const values = keys.map((column) => row[column]);
      const key = JSON.stringify(values);
      if (values.some((value) => value == null) || seen.has(key))
        throw new Error(
          `The profile backup has a missing or duplicate ${table} identifier. Retry after training changes have finished.`,
        );
      seen.add(key);
    }
  }
  for (const relation of PROFILE_BACKUP_RELATIONS) {
    if (relation.targetSchema !== "public" || !(relation.targetTable in data)) continue;
    const targets = data[relation.targetTable as BackupTable];
    const targetKeys = new Set(
      targets.map((target) =>
        JSON.stringify(relation.targetColumns.map((column) => target[column])),
      ),
    );
    for (const row of data[relation.table as BackupTable]) {
      const values = relation.columns.map((column) => row[column]);
      if (values.some((value) => value == null)) continue;
      const found = targetKeys.has(JSON.stringify(values));
      if (found) continue;
      if (
        relation.targetTable === "people" &&
        relation.columns.length === 1 &&
        actorColumns.has(`${relation.table}.${relation.columns[0]}`)
      ) {
        externalPeople.add(String(values[0]));
        continue;
      }
      throw new Error(
        `The profile backup is missing a referenced ${relation.targetTable} record (${relation.table}.${relation.columns.join(",")}). Retry after training changes have finished.`,
      );
    }
  }
  for (const table of PROFILE_BACKUP_TABLES) {
    for (const row of data[table]) {
      if (row.person_id != null && row.person_id !== personId)
        throw new Error("The profile backup contains data for another training profile.");
      if (typeof row.id === "number" && !Number.isSafeInteger(row.id))
        throw new Error(
          "The profile backup cannot preserve an identifier outside the safe integer range.",
        );
    }
  }
  const people = data.people;
  if (people.length !== 1 || people[0].id !== personId)
    throw new Error("The profile backup could not confirm its training profile.");
  for (const review of data.programme_strength_week_reviews) {
    const assignment = data.program_assignments.find(
      (row) => row.id === review.program_assignment_id,
    );
    if (!assignment || review.person_id !== assignment.person_id)
      throw new Error("The profile backup contains a review with a different assignment owner.");
  }
  return {
    ...data,
    backup_type: "train-track-profile",
    schema_version: 2,
    person_id: personId,
    exported_at: new Date().toISOString(),
    backup_manifest: {
      table_counts: Object.fromEntries(
        PROFILE_BACKUP_TABLES.map((table) => [table, data[table].length]),
      ) as Record<BackupTable, number>,
      external_people_ids: [...externalPeople].sort(),
      excluded: [
        "Supabase Auth accounts, credentials and access permissions",
        "Database schema, functions and server configuration",
        "Private server sync receipts and data-quality reversal snapshots",
        "Device-local drafts, unsynced workouts, favourites and display preferences",
      ],
    },
  };
}
export function readProfileBackup(value: string): ProfileBackup {
  const backup = JSON.parse(value) as Partial<ProfileBackup>;
  if (
    !backup ||
    backup.backup_type !== "train-track-profile" ||
    ![1, 2].includes(backup.schema_version ?? 0) ||
    typeof backup.person_id !== "string" ||
    typeof backup.exported_at !== "string" ||
    Number.isNaN(Date.parse(backup.exported_at))
  )
    throw new Error("This is not a supported Train & Track profile backup.");
  // v1 predates programme date overrides. Upgrade only an absent table/count;
  // a malformed or partially missing newer record must still fail validation.
  if (
    backup.schema_version === 1 &&
    backup.programme_session_dates === undefined &&
    backup.backup_manifest?.table_counts?.programme_session_dates === undefined
  ) {
    backup.programme_session_dates = [];
    if (backup.backup_manifest?.table_counts)
      backup.backup_manifest.table_counts.programme_session_dates = 0;
  }
  for (const table of PROFILE_BACKUP_TABLES) {
    const rows = backup[table];
    if (
      !Array.isArray(rows) ||
      rows.some((row) => !row || typeof row !== "object" || Array.isArray(row)) ||
      backup.backup_manifest?.table_counts?.[table] !== rows.length
    )
      throw new Error(`The profile backup has an invalid ${table} table or record count.`);
  }
  const checked = makeProfileBackup(backup as ProfileBackupData, backup.person_id);
  if (
    JSON.stringify(checked.backup_manifest.external_people_ids) !==
    JSON.stringify(backup.backup_manifest?.external_people_ids)
  )
    throw new Error("The profile backup has inconsistent external references.");
  return { ...backup, schema_version: 2 } as ProfileBackup;
}
