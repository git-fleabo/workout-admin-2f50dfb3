import test from "node:test";
import assert from "node:assert/strict";
import { temporaryPostgres, pgSkip, json } from "./helpers/temporary-postgres.ts";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const exercise = {
  id: "e",
  exerciseId: null,
  name: "External rotation",
  sets: 2,
  reps: "10–12",
  weight: 1.25,
  hold: null,
  side: "each",
  load: "per_hand",
  setup: "Elbow supported",
  source: "",
};
const quick = {
  id: "daily",
  name: "Easy movement",
  mode: "quick",
  minutes: 5,
  weekdays: [1, 2, 3, 4, 5],
  exercises: [exercise],
  notes: "",
  nextMorning: true,
  progression: "Repeat until comfortable",
};
const measured = {
  ...quick,
  id: "strength",
  name: "Strengthening",
  mode: "measured",
  weekdays: [1, 5],
};
test(
  "recovery lifecycle, provenance, immutability and ownership in isolated PostgreSQL",
  { skip: pgSkip },
  async (t) => {
    const db = temporaryPostgres();
    try {
      db.file(new URL("./fixtures/recovery-database.sql", import.meta.url));
      db.file(
        new URL(
          "../supabase/migrations/20260930112752_mobility_practice_pilot.sql",
          import.meta.url,
        ),
      );
      db.file(
        new URL("../supabase/migrations/20261028191229_mobility_recovery.sql", import.meta.url),
      );
      db.sql(
        `insert into people values('${id(1)}'),('${id(2)}'); insert into program_assignments values('${id(3)}','${id(1)}',7,'{"load":60}');`,
      );
      const baseline = db.sql("select row_to_json(p) from program_assignments p");
      db.sql(
        `insert into recovery_routines(id,person_id,name,templates) values('${id(10)}','${id(1)}','Left shoulder',${json([quick, measured])})`,
        id(1),
      );
      const start = (template: string, person = id(1), routine = id(10)) =>
        JSON.parse(
          db.sql(
            `select row_to_json(s) from start_recovery_session('${person}','${routine}',null,'${template}','2026-10-26') s`,
            person,
          ),
        );
      const q = start("daily");
      await t.test(
        "start retries return one draft; quick completion keeps unknowns null and no actual sets",
        () => {
          assert.equal(start("daily").id, q.id);
          db.sql(
            `update recovery_sessions set status='completed',completed_at=now() where id='${q.id}'`,
            id(1),
          );
          assert.equal(
            db.sql(
              `select actuals='[]' and pain is null and response is null from recovery_sessions where id='${q.id}'`,
              id(1),
            ),
            "t",
          );
          db.sql(
            `update recovery_sessions set response='same',response_notes='Settled by morning' where id='${q.id}'`,
            id(1),
          );
          assert.equal(
            db.sql(`select response from recovery_sessions where id='${q.id}'`, id(1)),
            "same",
          );
        },
      );
      const m = start("strength");
      await t.test("editing targets cannot change the draft snapshot or completed history", () => {
        db.sql(
          `update recovery_routines set templates=${json([quick, { ...measured, exercises: [{ ...exercise, weight: 2.5 }] }])} where id='${id(10)}' and version=1`,
          id(1),
        );
        assert.equal(
          db.sql(
            `select snapshot->'exercises'->0->>'weight' from recovery_sessions where id='${m.id}'`,
            id(1),
          ),
          "1.25",
        );
        assert.equal(
          db.sql(
            `update recovery_routines set name='stale edit' where id='${id(10)}' and version=1 returning id`,
            id(1),
          ),
          "",
        );
        assert.throws(
          () =>
            db.sql(
              `update recovery_sessions set notes='replace results' where id='${q.id}'`,
              id(1),
            ),
          /cannot be replaced/,
        );
        assert.throws(
          () =>
            db.sql(
              `update recovery_sessions set snapshot=${json(quick)} where id='${m.id}'`,
              id(1),
            ),
          /immutable/,
        );
      });
      await t.test(
        "measured results validate sides and numbers; resume and stale saves preserve work",
        () => {
          assert.throws(
            () =>
              db.sql(
                `update recovery_sessions set status='completed',completed_at=now() where id='${m.id}'`,
                id(1),
              ),
            /Record actual work/,
          );
          const actual = {
            exerciseId: "e",
            side: "left",
            set: 1,
            reps: 12,
            weight: 1.25,
            hold: null,
            range: "70 degrees",
            technique: "Controlled",
          };
          assert.throws(
            () =>
              db.sql(
                `update recovery_sessions set actuals=${json([{ ...actual, side: "none" }])} where id='${m.id}'`,
                id(1),
              ),
            /does not match/,
          );
          db.sql(
            `update recovery_sessions set actuals=${json([actual])},pain=0 where id='${m.id}' and version=1`,
            id(1),
          );
          assert.equal(start("strength").actuals[0].weight, 1.25);
          assert.equal(
            db.sql(
              `update recovery_sessions set notes='stale' where id='${m.id}' and version=1 returning id`,
              id(1),
            ),
            "",
          );
          db.sql(
            `update recovery_sessions set status='completed',completed_at=now() where id='${m.id}' and status='draft'`,
            id(1),
          );
          assert.equal(
            db.sql(
              `update recovery_sessions set status='completed',completed_at=now() where id='${m.id}' and status='draft' returning id`,
              id(1),
            ),
            "",
          );
        },
      );
      await t.test(
        "pause and archive block new starts, maintenance allows them, cancellation permits a fresh draft",
        () => {
          for (const status of ["paused", "archived"]) {
            db.sql(`update recovery_routines set status='${status}' where id='${id(10)}'`, id(1));
            assert.throws(() => start("daily"), /Activate/);
          }
          db.sql(`update recovery_routines set status='maintenance' where id='${id(10)}'`, id(1));
          const draft = start("daily");
          db.sql(`update recovery_sessions set status='cancelled' where id='${draft.id}'`, id(1));
          assert.notEqual(start("daily").id, draft.id);
        },
      );
      await t.test(
        "other users cannot read, mutate, start, link or reassign routines and sessions; anon has no grants",
        () => {
          assert.equal(db.sql("select count(*) from recovery_routines", id(2)), "0");
          assert.equal(db.sql("select count(*) from recovery_sessions", id(2)), "0");
          assert.equal(
            db.sql(
              `update recovery_routines set name='intrusion' where id='${id(10)}' returning id`,
              id(2),
            ),
            "",
          );
          assert.equal(
            db.sql(
              `update recovery_sessions set response='worse' where id='${q.id}' returning id`,
              id(2),
            ),
            "",
          );
          assert.throws(() => start("daily", id(2)), /not available/);
          assert.throws(
            () =>
              db.sql(
                `insert into recovery_routines(person_id,name,templates) values('${id(1)}','intrusion',${json([quick])})`,
                id(2),
              ),
            /row-level security/,
          );
          assert.throws(
            () =>
              db.sql(
                `update recovery_routines set person_id='${id(2)}' where id='${id(10)}'`,
                id(1),
              ),
            /identity/,
          );
          assert.throws(
            () => db.sql("select * from recovery_routines", id(1), "anon"),
            /permission denied/,
          );
          assert.throws(
            () => db.sql(`delete from recovery_sessions where id='${q.id}'`, id(1)),
            /permission denied/,
          );
          assert.throws(
            () =>
              db.sql(
                `insert into recovery_sessions(person_id,routine_id,template_id,routine_name,session_date,snapshot) values('${id(2)}','${id(10)}','daily','Fake','2026-10-26',${json(quick)})`,
                id(2),
              ),
            /foreign key/,
          );
        },
      );
      await t.test(
        "legacy routines and schedules are linked, never copied; completion never advances strength",
        () => {
          db.sql(
            `insert into mobility_practice_runs(id,person_id,skill,notes) values('${id(20)}','${id(1)}','pike','Original notes'); insert into mobility_practice_drills(id,run_id,name,target_sets,target_reps) values('${id(21)}','${id(20)}','Original drill',2,'5 per side'); insert into suggested_workouts(id,person_id,mobility_practice_run_id,plan_kind,status,suggested_for) values('${id(22)}','${id(1)}','${id(20)}','mobility','pending','2026-10-26');`,
          );
          const legacyBaseline = db.sql("select row_to_json(d) from mobility_practice_drills d");
          const legacyStart = () =>
            JSON.parse(
              db.sql(
                `select row_to_json(s) from start_recovery_session('${id(1)}',null,'${id(20)}','legacy','2026-10-26','${id(22)}') s`,
                id(1),
              ),
            );
          const s = legacyStart();
          assert.equal(s.snapshot.exercises[0].reps, "5 per side");
          db.sql(`update recovery_sessions set status='skipped' where id='${s.id}'`, id(1));
          assert.equal(legacyStart().id, s.id);
          assert.equal(
            db.sql(`select status from suggested_workouts where id='${id(22)}'`),
            "archived",
          );
          assert.equal(
            db.sql("select row_to_json(d) from mobility_practice_drills d"),
            legacyBaseline,
          );
          assert.equal(db.sql("select row_to_json(p) from program_assignments p"), baseline);
        },
      );
      await t.test(
        "scheduled legacy completion links once and rejects an unrelated schedule",
        () => {
          db.sql(
            `insert into suggested_workouts(id,person_id,mobility_practice_run_id,plan_kind,status,suggested_for) values('${id(23)}','${id(1)}','${id(20)}','mobility','pending','2026-10-30'),('${id(24)}','${id(1)}',null,'strength','pending','2026-10-30');`,
          );
          assert.throws(
            () =>
              db.sql(
                `select start_recovery_session('${id(1)}',null,'${id(20)}','legacy','2026-10-30','${id(24)}')`,
                id(1),
              ),
            /provenance mismatch/,
          );
          const started = JSON.parse(
            db.sql(
              `select row_to_json(s) from start_recovery_session('${id(1)}',null,'${id(20)}','legacy','2026-10-30','${id(23)}') s`,
              id(1),
            ),
          );
          const actual = {
            exerciseId: id(21),
            side: "none",
            set: 1,
            reps: 5,
            weight: null,
            hold: null,
            range: "",
            technique: "",
          };
          db.sql(
            `update recovery_sessions set actuals=${json([actual])},status='completed',completed_at=now() where id='${started.id}'`,
            id(1),
          );
          assert.equal(
            db.sql(`select status from suggested_workouts where id='${id(23)}'`),
            "completed",
          );
          assert.equal(
            db.sql(`select count(*) from recovery_sessions where suggested_workout_id='${id(23)}'`),
            "1",
          );
          assert.equal(
            db.sql(
              `select (start_recovery_session('${id(1)}',null,'${id(20)}','legacy','2026-10-30','${id(23)}')).id`,
              id(1),
            ),
            started.id,
          );
          assert.equal(db.sql("select row_to_json(p) from program_assignments p"), baseline);
        },
      );
      await t.test(
        "legacy classification defaults unknown; explicit recovery excludes only that whole session",
        () => {
          db.sql(
            `insert into sessions(id,person_id,mobility_practice_run_id,completed) values('${id(30)}','${id(1)}','${id(20)}',true),('${id(31)}','${id(1)}','${id(20)}',true);`,
          );
          assert.equal(db.sql("select count(*) from sessions where recovery_only=false"), "2");
          db.sql(`update sessions set recovery_only=true where id='${id(30)}'`, id(1));
          assert.equal(db.sql("select id from sessions where recovery_only=false"), id(31));
        },
      );
    } finally {
      db.close();
    }
  },
);
