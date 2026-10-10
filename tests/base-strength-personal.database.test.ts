import test from "node:test";
import assert from "node:assert/strict";
import { pgSkip, temporaryPostgres, json } from "./helpers/temporary-postgres.ts";
import { coachDatabaseMigrations } from "./helpers/coach-database-migrations.ts";
import {
  buildBaseStrengthPersonalSessions,
  type BaseStrengthProgressionReview,
} from "../src/lib/base-strength-personal.ts";
import { DEFAULT_VOLUME_INTENSITY_OPTIONS } from "../src/lib/base-strength-preview.ts";
import {
  strengthId as id,
  strengthChoices,
  strengthTemplate,
} from "./helpers/base-strength-fixtures.ts";

test(
  "Base Strength paused saving, exact linked progression, stale guards and isolation",
  { skip: pgSkip },
  async (t) => {
    const db = temporaryPostgres();
    const { sql } = db;
    try {
      db.file(new URL("./fixtures/personal-programme-database.sql", import.meta.url));
      db.file(new URL("./fixtures/coach-journey-database.sql", import.meta.url));
      db.file(new URL("./fixtures/base-strength-database.sql", import.meta.url));
      for (const migration of [
        ...coachDatabaseMigrations,
        "20261010115211_add_personal_strength_week_reviews.sql",
        "20261010134112_add_base_strength_personal_programmes.sql",
        "20261010224715_add_base_strength_dup.sql",
        "20261010225150_protect_dup_personal_setup.sql",
      ])
        db.file(new URL(`../supabase/migrations/${migration}`, import.meta.url));
      sql(
        `insert into public.people values('${id(1)}'),('${id(2)}'); insert into public.exercises select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(10,60) n; insert into public.training_locations values('${id(5)}','${id(1)}','gym',true);`,
      );
      const programId = sql(
        "select id from public.programs where method_type='base_strength_bullmastiff'",
      );
      const template = strengthTemplate("bullmastiff");
      template.id = programId;
      const ids = JSON.parse(
        sql(
          `select jsonb_agg(id order by sequence_index) from public.program_workouts where program_id='${programId}'`,
        ),
      ) as string[];
      template.workouts.forEach((w, i) => (w.id = ids[i]));
      const sessions = buildBaseStrengthPersonalSessions({
        programme: "bullmastiff",
        options: DEFAULT_VOLUME_INTENSITY_OPTIONS,
        template,
        choices: strengthChoices("bullmastiff"),
        startedOn: "2026-10-12",
        increment: 2.5,
        locationKind: "gym",
      });
      const assignment = sql(
        `select public.create_personal_programme('${id(1)}','${programId}','Personal Bullmastiff','2026-10-12',${json(sessions)})`,
        id(1),
      );
      assert.equal(
        sql(`select status from public.program_assignments where id='${assignment}'`, id(1)),
        "paused",
      );
      assert.equal(
        sql(
          `select count(*) from public.personal_programme_sessions where assignment_id='${assignment}'`,
          id(1),
        ),
        "72",
      );
      const review = (workout = ids[4], key = "bs:0:0", person = id(1)) =>
        JSON.parse(
          sql(
            `select public.review_base_strength_progression('${assignment}','${workout}','${key}')`,
            person,
          ),
        ) as BaseStrengthProgressionReview;
      const apply = (r: BaseStrengthProgressionReview) =>
        sql(
          `select public.apply_base_strength_progression('${assignment}','${ids[4]}','bs:0:0',${r.revision},'${r.fingerprint}')`,
          id(1),
        );
      assert.equal(review().kind, "review");
      sql(`update public.program_assignments set status='active' where id='${assignment}'`, id(1));
      const start = (workout: string, revision = 1, easier = false) =>
        sql(
          `select public.start_personal_programme_session('${assignment}','${workout}',${revision},'${id(5)}',${easier},null)`,
          id(1),
        );
      const suggested = start(ids[0]);
      assert.equal(
        sql(
          `select target_metrics->'base_strength'->>'plusLastSet' from public.suggested_workout_entries where suggested_workout_id='${suggested}' and order_index=0`,
          id(1),
        ),
        "true",
      );
      sql(
        `insert into public.sessions values('${id(6)}','${id(1)}',true); insert into public.session_entries(id,session_id,exercise_id,order_index) values('${id(7)}','${id(6)}','${id(10)}',0);
  insert into public.entry_sets(session_entry_id,set_number,reps,weight) values ${[6, 6, 6, 11].map((reps, i) => `('${id(7)}',${i + 1},${reps},70)`).join(",")};
  select * from public.complete_suggested_workout('${suggested}','${id(6)}');`,
        id(1),
      );
      const originalHistory = sql(
        `select jsonb_agg(to_jsonb(s) order by set_number) from public.entry_sets s where session_entry_id='${id(7)}'`,
      );
      const proposal = review();
      assert.equal(proposal.kind, "increase");
      assert.equal(proposal.load, 75);
      assert.equal(proposal.previousSessionId, id(6));
      await t.test("standalone and supporting workouts do not drive the source decision", () => {
        sql(
          `insert into public.sessions values('${id(65)}','${id(1)}',true);
          insert into public.session_entries(id,session_id,exercise_id,order_index) values('${id(66)}','${id(65)}','${id(10)}',0);
          insert into public.entry_sets(session_entry_id,set_number,reps,weight) values('${id(66)}',1,999,999);
          insert into public.goals(id,person_id,status,exercise_id) values('${id(68)}','${id(1)}','active','${id(10)}');
          insert into public.suggested_workouts(id,person_id,program_assignment_id,goal_id,plan_kind,status,completed_session_id) values('${id(67)}','${id(1)}','${assignment}','${id(68)}','skill','completed','${id(65)}')`,
          id(1),
        );
        assert.equal(review().load, 75);
        assert.equal(review().previousSessionId, id(6));
        assert.equal(
          sql(
            `select current_workout_index from public.program_assignments where id='${assignment}'`,
            id(1),
          ),
          "1",
        );
      });
      await t.test("changed log rejects a previously reviewed load", () => {
        sql(
          `update public.entry_sets set reps=12 where session_entry_id='${id(7)}' and set_number=4`,
          id(1),
        );
        assert.throws(() => apply(proposal), /workout log changed/);
        sql(
          `update public.entry_sets set reps=11 where session_entry_id='${id(7)}' and set_number=4`,
          id(1),
        );
      });
      await t.test("approve only this future movement and preserve completed history", () => {
        apply(review());
        assert.equal(
          Number(
            sql(
              `select plan->'movements'->0->'setRows'->0->>'weight' from public.personal_programme_sessions where assignment_id='${assignment}' and program_workout_id='${ids[4]}'`,
              id(1),
            ),
          ),
          75,
        );
        assert.equal(
          sql(
            `select plan->'movements'->0->'setRows'->0->>'weight' from public.personal_programme_sessions where assignment_id='${assignment}' and program_workout_id='${ids[8]}'`,
            id(1),
          ),
          "",
        );
        assert.throws(() => apply(proposal), /programme or workout log changed/);
        assert.equal(
          sql(
            `select jsonb_agg(to_jsonb(s) order by set_number) from public.entry_sets s where session_entry_id='${id(7)}'`,
          ),
          originalHistory,
        );
      });
      await t.test(
        "reject missing sets, missed earlier target, ambiguous load and special methods",
        () => {
          for (const change of [
            "completed=false",
            "reps=5",
            "load_semantics='unknown'",
            "data_shape='aggregate'",
            "weight=65",
          ]) {
            sql(
              `update public.entry_sets set ${change} where session_entry_id='${id(7)}' and set_number=1`,
              id(1),
            );
            assert.equal(review().kind, "review", change);
            sql(
              `update public.entry_sets set completed=true,reps=6,load_semantics='total_external_load',data_shape='individual',weight=70 where session_entry_id='${id(7)}' and set_number=1`,
              id(1),
            );
          }
          sql(
            `insert into public.entry_set_segments(entry_set_id) select id from public.entry_sets where session_entry_id='${id(7)}' and set_number=1`,
            id(1),
          );
          assert.equal(review().kind, "review");
          sql("delete from public.entry_set_segments", id(1));
        },
      );
      await t.test(
        "approval is checked again when starting, and unknown next loads cannot start",
        () => {
          sql(
            `update public.program_assignments set current_workout_index=4 where id='${assignment}'`,
            id(1),
          );
          sql(
            `update public.entry_sets set reps=12 where session_entry_id='${id(7)}' and set_number=4`,
            id(1),
          );
          assert.throws(() => start(ids[4], 2), /approved plus-set decision changed/);
          sql(
            `update public.entry_sets set reps=11 where session_entry_id='${id(7)}' and set_number=4`,
            id(1),
          );
          start(ids[4], 2);
          sql(
            `update public.program_assignments set current_workout_index=8 where id='${assignment}'`,
            id(1),
          );
          assert.throws(() => start(ids[8]), /Review the load and targets/);
        },
      );
      await t.test(
        "other people and anonymous callers cannot read or apply private decisions",
        () => {
          assert.equal(
            sql(
              `select count(*) from public.personal_programmes where assignment_id='${assignment}'`,
              id(2),
            ),
            "0",
          );
          assert.throws(() => review(ids[4], "bs:0:0", id(2)), /not accessible/);
          assert.throws(
            () =>
              sql(
                `select public.apply_base_strength_progression('${assignment}','${ids[4]}','bs:0:0',2,'${proposal.fingerprint}')`,
                id(2),
              ),
            /not accessible/,
          );
          assert.throws(
            () =>
              sql(
                `select public.review_base_strength_progression('${assignment}','${ids[4]}','bs:0:0')`,
                id(2),
                "anon",
              ),
            /permission denied/,
          );
        },
      );
      await t.test("new waves reset and the peak phase requires its own reassessed max", () => {
        const finishWeek = (
          index: number,
          sessionId: string,
          entryId: string,
          reps: number[],
          load: number,
        ) => {
          sql(
            `update public.program_assignments set current_workout_index=${index} where id='${assignment}';
            update public.personal_programme_sessions set plan=jsonb_set(plan,'{movements,0,setRows}',${json(reps.map(() => ({ reps: String(index === 8 ? 6 : 4), weight: String(load), durationSeconds: "", rpe: "", completed: true })))}) where assignment_id='${assignment}' and program_workout_id='${ids[index]}'`,
            id(1),
          );
          const linked = start(ids[index], 2);
          sql(
            `insert into public.sessions values('${sessionId}','${id(1)}',true);
            insert into public.session_entries(id,session_id,exercise_id,order_index) values('${entryId}','${sessionId}','${id(10)}',0);
            insert into public.entry_sets(session_entry_id,set_number,reps,weight) values ${reps.map((r, i) => `('${entryId}',${i + 1},${r},${load})`).join(",")};
            select * from public.complete_suggested_workout('${linked}','${sessionId}')`,
            id(1),
          );
        };
        finishWeek(8, id(61), id(62), [6, 6, 6, 20], 70);
        assert.equal(review(ids[12]).kind, "reset");
        assert.equal(review(ids[12]).load, 75);
        finishWeek(32, id(63), id(64), [4, 4, 4, 8], 95);
        assert.equal(review(ids[36]).kind, "review");
        assert.match(review(ids[36]).detail, /Reassess/);
        sql(
          `update public.personal_programme_sessions set plan=jsonb_set(plan,'{movements,0,baseStrength,referenceMax}','120'::jsonb) where assignment_id='${assignment}' and program_workout_id='${ids[36]}'`,
          id(1),
        );
        const peak = review(ids[36]);
        assert.equal(peak.kind, "reset");
        assert.equal(peak.load, 102.5);
      });
      await t.test("restarts are paused and discard old run plus-set loads", () => {
        const restarted = sql(
          `select public.change_programme_run('${assignment}','restart','2026-11-02')`,
          id(1),
        );
        assert.equal(
          sql(`select status from public.program_assignments where id='${restarted}'`, id(1)),
          "paused",
        );
        assert.equal(
          sql(
            `select plan->'movements'->0->'setRows'->0->>'weight' from public.personal_programme_sessions where assignment_id='${restarted}' and program_workout_id='${ids[4]}'`,
            id(1),
          ),
          "",
        );
        assert.equal(
          sql(
            `select plan->'movements'->0->'baseStrength' ? 'approvedFingerprint' from public.personal_programme_sessions where assignment_id='${restarted}' and program_workout_id='${ids[4]}'`,
            id(1),
          ),
          "f",
        );
        assert.equal(
          sql(`select status from public.suggested_workouts where id='${suggested}'`, id(1)),
          "completed",
        );
      });
    } finally {
      db.close();
    }
  },
);
