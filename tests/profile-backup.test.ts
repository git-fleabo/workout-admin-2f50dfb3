import assert from "node:assert/strict";
import test from "node:test";
import {
  PROFILE_BACKUP_TABLES,
  makeProfileBackup,
  readProfileBackup,
  type ProfileBackupData,
} from "../src/lib/profile-backup.ts";
const empty = (): ProfileBackupData => {
  const data = {} as ProfileBackupData;
  for (const table of PROFILE_BACKUP_TABLES) data[table] = [];
  data.people = [{ id: "person" }];
  return data;
};
test("profile backups carry a version, explicit table counts and recovery exclusions", () => {
  const backup = makeProfileBackup(empty(), "person");
  assert.equal(backup.schema_version, 3);
  assert.equal(PROFILE_BACKUP_TABLES.length, 59);
  assert.equal(backup.backup_manifest.table_counts.people, 1);
  assert.ok(backup.backup_manifest.excluded.some((item) => item.includes("Auth")));
  assert.ok(backup.backup_manifest.excluded.some((item) => item.includes("unsynced")));
  assert.deepEqual(readProfileBackup(JSON.stringify(backup)), backup);
});

test("backups predating rest days remain readable", () => {
  const old = JSON.parse(JSON.stringify(makeProfileBackup(empty(), "person")));
  delete old.training_rest_days;
  delete old.backup_manifest.table_counts.training_rest_days;
  assert.deepEqual(readProfileBackup(JSON.stringify(old)).training_rest_days, []);
});
test("reader rejects partial, unsupported and inconsistent backups rather than accepting data loss", () => {
  const backup = makeProfileBackup(empty(), "person");
  assert.throws(() => readProfileBackup("null"), /not a supported/);
  assert.throws(
    () => readProfileBackup(JSON.stringify({ ...backup, schema_version: 4 })),
    /not a supported/,
  );
  assert.throws(
    () => readProfileBackup(JSON.stringify({ ...backup, personal_programme_sessions: undefined })),
    /invalid personal_programme_sessions/,
  );
  assert.throws(
    () =>
      readProfileBackup(
        JSON.stringify({
          ...backup,
          backup_manifest: {
            ...backup.backup_manifest,
            table_counts: { ...backup.backup_manifest.table_counts, people: 2 },
          },
        }),
      ),
    /record count/,
  );
});
test("referential closure and record identity are verified before a backup is offered", () => {
  const data = empty();
  data.program_assignments = [{ id: "assignment", person_id: "person", program_id: "missing" }];
  assert.throws(() => makeProfileBackup(data, "person"), /missing a referenced programs/);
  const duplicate = empty();
  duplicate.sessions = [
    { id: "session", person_id: "person" },
    { id: "session", person_id: "person" },
  ];
  assert.throws(() => makeProfileBackup(duplicate, "person"), /duplicate sessions identifier/);
  const unsafe = empty();
  unsafe.data_quality_audit_events = [{ id: Number.MAX_SAFE_INTEGER + 1 }];
  assert.throws(() => makeProfileBackup(unsafe, "person"), /safe integer range/);
});
test("shared catalogue authors are listed as external IDs without exporting their profiles", () => {
  const data = empty();
  data.programs = [{ id: "template", created_by_person_id: "author" }];
  const backup = makeProfileBackup(data, "person");
  assert.deepEqual(backup.backup_manifest.external_people_ids, ["author"]);
  assert.deepEqual(backup.people, [{ id: "person" }]);
  const foreign = empty();
  foreign.sessions = [{ id: "other", person_id: "another person" }];
  assert.throws(() => makeProfileBackup(foreign, "person"));
  assert.throws(
    () =>
      readProfileBackup(
        JSON.stringify({
          ...backup,
          backup_manifest: { ...backup.backup_manifest, external_people_ids: [] },
        }),
      ),
    /external references/,
  );
});

test("old v1 backups remain readable and new backups require the programme dates table", () => {
  const backup = makeProfileBackup(empty(), "person");
  const old = JSON.parse(JSON.stringify(backup));
  old.schema_version = 1;
  delete old.programme_session_dates;
  delete old.backup_manifest.table_counts.programme_session_dates;
  const read = readProfileBackup(JSON.stringify(old));
  assert.equal(read.schema_version, 3);
  assert.deepEqual(read.programme_session_dates, []);
  assert.equal(read.backup_manifest.table_counts.programme_session_dates, 0);
  const partial = JSON.parse(JSON.stringify(backup));
  delete partial.programme_session_dates;
  assert.throws(
    () => readProfileBackup(JSON.stringify(partial)),
    /invalid programme_session_dates/,
  );
});

test("backups before recovery remain readable without invented recovery records", () => {
  const old = JSON.parse(JSON.stringify(makeProfileBackup(empty(), "person")));
  old.schema_version = 2;
  for (const table of ["recovery_routines", "recovery_sessions"]) {
    delete old[table];
    delete old.backup_manifest.table_counts[table];
  }
  const upgraded = readProfileBackup(JSON.stringify(old));
  assert.equal(upgraded.schema_version, 3);
  assert.deepEqual(upgraded.recovery_routines, []);
  assert.deepEqual(upgraded.recovery_sessions, []);
});
