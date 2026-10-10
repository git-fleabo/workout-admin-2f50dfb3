import test from "node:test";
import assert from "node:assert/strict";
import { pgSkip, temporaryPostgres, json } from "./helpers/temporary-postgres.ts";
import { coachDatabaseMigrations } from "./helpers/coach-database-migrations.ts";
import { buildBaseStrengthPersonalSessions } from "../src/lib/base-strength-personal.ts";
import { DEFAULT_VOLUME_INTENSITY_OPTIONS as options } from "../src/lib/base-strength-preview.ts";
import { dupBackOffRows } from "../src/lib/base-strength-backoff.ts";
import {
  strengthId as id,
  strengthChoices,
  strengthTemplate,
} from "./helpers/base-strength-fixtures.ts";

const migration = "20261010224715_add_base_strength_dup.sql";

test(
  "DUP additive catalogue, paused saving, protected targets, completion and fresh restarts",
  { skip: pgSkip },
  async (t) => {
    const db = temporaryPostgres();
    const { sql } = db;
    try {
      for (const fixture of [
        "personal-programme-database.sql",
        "coach-journey-database.sql",
        "base-strength-database.sql",
      ])
        db.file(new URL(`./fixtures/${fixture}`, import.meta.url));
      for (const m of [
        ...coachDatabaseMigrations,
        "20261010115211_add_personal_strength_week_reviews.sql",
        "20261010134112_add_base_strength_personal_programmes.sql",
      ])
        db.file(new URL(`../supabase/migrations/${m}`, import.meta.url));
      sql(
        `insert into public.people values('${id(1)}'),('${id(2)}'); insert into public.exercises select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(10,60) n; insert into public.training_locations values('${id(5)}','${id(1)}','gym',true),('${id(9)}','${id(2)}','gym',true); create table public.program_workout_entries(program_workout_id uuid);`,
      );
      const sessionsFor = (programme: "dup" | "volume_intensity", weeks: number) => {
        const template = strengthTemplate(programme, weeks);
        template.id = sql(
          `select id from public.programs where method_type='base_strength_${programme}' and duration_weeks=${weeks}`,
        );
        const ids = JSON.parse(
          sql(
            `select jsonb_agg(id order by sequence_index) from public.program_workouts where program_id='${template.id}'`,
          ),
        ) as string[];
        template.workouts.forEach((w, i) => (w.id = ids[i]));
        return {
          template,
          sessions: buildBaseStrengthPersonalSessions({
            programme,
            options,
            template,
            choices: strengthChoices(programme),
            startedOn: "2026-10-12",
            increment: 2.5,
            locationKind: "gym",
          }),
        };
      };
      const original = sessionsFor("volume_intensity", 18);
      const originalAssignment = sql(
        `select public.create_personal_programme('${id(1)}','${original.template.id}','Original plan','2026-10-12',${json(original.sessions)})`,
        id(1),
      );
      sql(
        `update public.program_assignments set status='active',current_workout_index=3 where id='${originalAssignment}'; insert into public.sessions values('${id(6)}','${id(1)}',true); insert into public.session_entries(id,session_id,exercise_id,order_index) values('${id(7)}','${id(6)}','${id(10)}',0); insert into public.entry_sets(session_entry_id,set_number,reps,weight) values('${id(7)}',1,8,60);`,
        id(1),
      );
      const originalSnapshot = () =>
        sql(
          `select jsonb_build_object('assignment',(select to_jsonb(a) from public.program_assignments a where id='${originalAssignment}'), 'programme',(select to_jsonb(p) from public.programs p where id='${original.template.id}'), 'sessions',(select jsonb_agg(to_jsonb(s) order by program_workout_id) from public.personal_programme_sessions s where assignment_id='${originalAssignment}'), 'history',(select jsonb_agg(to_jsonb(s) order by id) from public.entry_sets s where session_entry_id='${id(7)}'))`,
        );
      const baseline = originalSnapshot();
      db.file(new URL(`../supabase/migrations/${migration}`, import.meta.url));
      db.file(
        new URL(
          "../supabase/migrations/20261010225150_protect_dup_personal_setup.sql",
          import.meta.url,
        ),
      );
      assert.equal(originalSnapshot(), baseline);
      assert.deepEqual(
        JSON.parse(
          sql(
            "select jsonb_agg(duration_weeks order by duration_weeks) from public.programs where method_type='base_strength_dup'",
          ),
        ),
        [6, 9, 12, 15],
      );
      assert.equal(
        sql(
          "select count(*) from public.program_workouts w join public.programs p on p.id=w.program_id where p.method_type='base_strength_dup'",
        ),
        "126",
      );
      assert.equal(
        sql(
          "select count(*) from public.program_workout_entries e join public.program_workouts w on w.id=e.program_workout_id join public.programs p on p.id=w.program_id where p.method_type='base_strength_dup'",
        ),
        "0",
      );
      const { template, sessions } = sessionsFor("dup", 6);
      await t.test("older generic pickers cannot assign or activate an empty DUP scaffold", () => {
        const count = sql("select count(*) from public.program_assignments");
        assert.throws(
          () =>
            sql(
              `insert into public.program_assignments(program_id,person_id,assigned_by_person_id,status,started_on) values('${template.id}','${id(2)}','${id(2)}','active','2026-10-12')`,
              id(2),
            ),
          /Set up DUP through Explore Base Strength/,
        );
        assert.equal(sql("select count(*) from public.program_assignments"), count);
        const empty = sql(
          `insert into public.program_assignments(program_id,person_id,assigned_by_person_id,status,started_on) values('${template.id}','${id(2)}','${id(2)}','paused','2026-10-12') returning id`,
          id(2),
        );
        assert.throws(
          () =>
            sql(`update public.program_assignments set status='active' where id='${empty}'`, id(2)),
          /Set up DUP through Explore Base Strength/,
        );
        assert.equal(
          sql(`select status from public.program_assignments where id='${empty}'`),
          "paused",
        );
        assert.equal(originalSnapshot(), baseline);
      });
      const assignment = sql(
        `select public.create_personal_programme('${id(2)}','${template.id}','Personal DUP','2026-10-12',${json(sessions)})`,
        id(2),
      );
      assert.equal(
        sql(`select status from public.program_assignments where id='${assignment}'`, id(2)),
        "paused",
      );
      assert.equal(
        sql(
          `select count(*) from public.personal_programme_sessions where assignment_id='${assignment}'`,
          id(2),
        ),
        "18",
      );
      assert.equal(originalSnapshot(), baseline);
      const peak = sessions[9];
      const save = (plan: typeof peak.plan, revision: number) =>
        sql(
          `select public.save_personal_programme_sessions('${assignment}',${json([{ ...peak, revision, plan }])})`,
          id(2),
        );
      const start = (workout: string, revision: number) =>
        sql(
          `select public.start_personal_programme_session('${assignment}','${workout}',${revision},'${id(9)}',false,null)`,
          id(2),
        );
      await t.test(
        "incomplete peak loads cannot start and inconsistent dependent loads cannot save",
        () => {
          sql(
            `update public.program_assignments set status='active',current_workout_index=9 where id='${assignment}'`,
            id(2),
          );
          assert.throws(() => start(peak.workoutId, 1), /Review the load and targets/);
          const invalid = structuredClone(peak.plan);
          invalid.movements[0].setRows[0].weight = "103";
          assert.throws(() => save(invalid, 1), /Recalculate DUP back-off/);
          const valid = structuredClone(peak.plan);
          valid.movements
            .slice(0, 3)
            .forEach((m) => (m.setRows = dupBackOffRows(m.setRows, "103", 2.5)));
          save(valid, 1);
          assert.throws(() => save(valid, 1), /changed|Refresh/i);
          const changed = structuredClone(valid);
          changed.movements[0].setRows.pop();
          assert.throws(() => save(changed, 2), /peak sets, reps and RPE/);
          const wrongRpe = structuredClone(valid);
          wrongRpe.movements[0].setRows[0].rpe = "10";
          assert.throws(() => save(wrongRpe, 2), /peak sets, reps and RPE/);
          const nullPercent = structuredClone(valid);
          delete nullPercent.movements[0].baseStrength!.backOffPercent;
          assert.throws(() => save(nullPercent, 2), /peak loads by RPE/);
        },
      );
      await t.test(
        "starting snapshots mixed top/back-off loads and completing advances only this run",
        () => {
          const started = start(peak.workoutId, 2);
          assert.equal(
            sql(
              `select target_metrics->'base_strength'->>'backOffPercent' from public.suggested_workout_entries where suggested_workout_id='${started}' and order_index=0`,
              id(2),
            ),
            "90",
          );
          assert.deepEqual(
            JSON.parse(
              sql(
                `select jsonb_agg(s.weight order by s.set_number) from public.suggested_workout_sets s join public.suggested_workout_entries e on e.id=s.suggested_workout_entry_id where e.suggested_workout_id='${started}' and e.order_index=0`,
                id(2),
              ),
            ),
            [103, 92.5, 92.5, 92.5, 92.5, 92.5],
          );
          sql(
            `insert into public.sessions values('${id(8)}','${id(2)}',true); select * from public.complete_suggested_workout('${started}','${id(8)}')`,
            id(2),
          );
          assert.equal(
            sql(
              `select current_workout_index from public.program_assignments where id='${assignment}'`,
              id(2),
            ),
            "10",
          );
          assert.equal(originalSnapshot(), baseline);
          assert.throws(() => save(peak.plan, 2), /started|completed|future/i);
        },
      );
      await t.test("other profiles and anonymous callers cannot edit or start private DUP", () => {
        assert.equal(
          sql(
            `select count(*) from public.personal_programme_sessions where assignment_id='${assignment}'`,
            id(1),
          ),
          "0",
        );
        assert.throws(
          () =>
            sql(
              `select public.start_personal_programme_session('${assignment}','${sessions[10].workoutId}',1,'${id(9)}',false,null)`,
              id(1),
            ),
          /not accessible|not found|Start or resume/i,
        );
        assert.throws(
          () =>
            sql(
              `select public.create_personal_programme('${id(1)}','${template.id}','No','2026-10-12',${json(sessions)})`,
              id(1),
              "anon",
            ),
          /permission denied/,
        );
      });
      await t.test(
        "explicit personal progression permits custom targets for only that future movement",
        () => {
          const future = structuredClone(sessions[10]);
          future.revision = 1;
          future.plan.movements[0].progression.type = "fixed";
          future.plan.movements[0].setRows = [
            { reps: "8", weight: "87", rpe: "6", durationSeconds: "", completed: true },
          ];
          sql(
            `select public.save_personal_programme_sessions('${assignment}',${json([future])})`,
            id(2),
          );
          assert.equal(
            sql(
              `select plan->'movements'->0->'setRows'->0->>'weight' from public.personal_programme_sessions where assignment_id='${assignment}' and program_workout_id='${future.workoutId}'`,
              id(2),
            ),
            "87",
          );
          assert.equal(originalSnapshot(), baseline);
        },
      );

      await t.test("restarting stays paused and clears every source peak load", () => {
        const restarted = sql(
          `select public.change_programme_run('${assignment}','restart','2026-11-02')`,
          id(2),
        );
        assert.equal(
          sql(`select status from public.program_assignments where id='${restarted}'`, id(2)),
          "paused",
        );
        assert.equal(
          sql(
            `select plan->'movements'->0->'setRows'->0->>'weight' from public.personal_programme_sessions where assignment_id='${restarted}' and program_workout_id='${sessions[0].workoutId}'`,
            id(2),
          ),
          "60",
        );
        assert.equal(
          sql(
            `select count(*) from public.personal_programme_sessions s cross join lateral jsonb_array_elements(plan->'movements') m cross join lateral jsonb_array_elements(m->'setRows') r where assignment_id='${restarted}' and m->'baseStrength'->>'phase'='peak' and m->'baseStrength'->>'role'='main' and m->'progression'->>'type'='source' and r->>'weight'<>''`,
            id(2),
          ),
          "0",
        );
        assert.equal(originalSnapshot(), baseline);
      });
    } finally {
      db.close();
    }
  },
);
