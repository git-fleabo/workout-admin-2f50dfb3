import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { pgSkip, temporaryPostgres, json } from "./helpers/temporary-postgres.ts";
import { coachDatabaseMigrations } from "./helpers/coach-database-migrations.ts";
import {
  personalStrengthAssignment,
  personalStrengthId as id,
} from "./helpers/personal-strength-fixtures.ts";

test(
  "personal strength-week approval, exact execution, protected history and restart",
  { skip: pgSkip },
  async (t) => {
    const db = temporaryPostgres();
    const { sql } = db;
    try {
      db.file(new URL("./fixtures/personal-programme-database.sql", import.meta.url));
      db.file(new URL("./fixtures/coach-journey-database.sql", import.meta.url));
      sql(`alter table public.programs add column sessions_per_week integer default 3;
      alter table public.program_workouts add column week_number integer;
      insert into public.people values('${id(1)}'),('${id(2)}');
      insert into public.exercises values('${id(10)}'),('${id(11)}'),('${id(12)}');
      insert into public.programs(id,is_template,method_type) values('${id(13)}',true,'jacked_dumbbell');
      insert into public.program_workouts(id,program_id,sequence_index,week_number) values
      ${[1, 2, 3, 7, 8, 9].map((sequence, i) => `('${id(20 + i)}','${id(13)}',${sequence},${i < 3 ? 1 : 2})`).join(",")};
      insert into public.training_locations values('${id(30)}','${id(1)}','gym',true);`);
      for (const migration of [
        ...coachDatabaseMigrations,
        "20261010115211_add_personal_strength_week_reviews.sql",
      ])
        db.file(new URL(`../supabase/migrations/${migration}`, import.meta.url));
      const tables = [
        "program_assignments",
        "personal_programmes",
        "personal_programme_sessions",
        "suggested_workouts",
        "suggested_workout_entries",
        "suggested_workout_sets",
        "sessions",
        "programme_strength_week_reviews",
      ];
      const snapshot = () =>
        sql(
          tables
            .map(
              (table) =>
                `select '${table}',md5(coalesce(string_agg(to_jsonb(r)::text,'' order by to_jsonb(r)::text),'')) from public.${table} r`,
            )
            .join(" union all "),
        );
      const baseline = snapshot();
      const sessions = personalStrengthAssignment.personalProgramme!.sessions;
      const assignment = sql(
        `select public.create_personal_programme('${id(1)}','${id(13)}','Personal review test','2026-10-12',${json(sessions)})`,
        id(1),
      );
      sql(`update public.program_assignments set status='active' where id='${assignment}'`, id(1));
      const originals = sql(
        `select jsonb_agg(to_jsonb(s) order by program_workout_id) from public.personal_programme_sessions s where assignment_id='${assignment}'`,
        id(1),
      );
      let current = 0,
        previous: string | null = null;
      let selected = [0, 1, 2].map((i) => ({ workout_id: id(20 + i), revision: 1 }));
      const adjustments = [
        {
          programme_key: "press:0",
          exercise_id: id(10),
          load_adjustment_percent: -5,
          set_adjustment: -1,
        },
        {
          programme_key: "grip:0",
          exercise_id: id(11),
          load_adjustment_percent: 0,
          set_adjustment: -1,
        },
      ];
      const apply = (choices = adjustments, person = id(1), kind = "reduce") =>
        sql(
          `select public.apply_personal_strength_week_review('${assignment}',${current},${json(selected)},'deload','${kind}',${json(choices)},${previous ? `'${previous}'` : "null"})`,
          person,
        );
      let expectedReviewId: string | null = null;
      const start = (i: number, revision = 1) =>
        sql(
          `select public.start_personal_programme_session('${assignment}','${id(20 + i)}',${revision},'${id(30)}',false,${expectedReviewId ? `'${expectedReviewId}'` : "null"})`,
          id(1),
        );
      const complete = (plan: string, i: number) => {
        sql(`insert into public.sessions values('${id(90 + i)}','${id(1)}',true)`, id(1));
        sql(`select * from public.complete_suggested_workout('${plan}','${id(90 + i)}')`, id(1));
      };
      const prescription = (plan: string) =>
        sql(
          `select e.name,s.set_number,s.reps,s.weight,s.duration_seconds,e.target_metrics from public.suggested_workout_entries e join public.suggested_workout_sets s on s.suggested_workout_entry_id=e.id where e.suggested_workout_id='${plan}' order by e.order_index,s.set_number`,
          id(1),
        );
      await t.test(
        "rejects stale sessions, wrong ranges, unsupported changes and foreign access without writes",
        () => {
          const before = snapshot();
          assert.throws(() => apply(adjustments, id(2)), /not found/);
          assert.throws(
            () =>
              sql(
                `select public.apply_personal_strength_week_review('${assignment}',0,'[]','normal','keep','[]')`,
                id(1),
                "anon",
              ),
            /permission denied/,
          );
          selected[1].revision = 0;
          assert.throws(() => apply(), /session changed/);
          selected[1].revision = 1;
          current = 1;
          assert.throws(() => apply(), /moved on/);
          current = 0;
          selected = [{ workout_id: id(23), revision: 1 }];
          assert.throws(() => apply(), /exact upcoming week/);
          selected = [0, 1, 2].map((i) => ({ workout_id: id(20 + i), revision: 1 }));
          assert.throws(
            () => apply([{ ...adjustments[0], load_adjustment_percent: -10 }, adjustments[1]]),
            /2.5 or 5 percent/,
          );
          assert.throws(
            () => apply([{ ...adjustments[0], set_adjustment: -2 }, adjustments[1]]),
            /one fewer set/,
          );
          assert.throws(() => apply([adjustments[0]]), /exactly once/);
          assert.equal(snapshot(), before);
        },
      );
      let firstReview: string, firstPlan: string, firstSnapshot: string;
      await t.test(
        "applies a separate reviewed plan with exact rounding and retains every original target",
        () => {
          firstReview = apply();
          expectedReviewId = firstReview;
          assert.equal(
            sql(
              `select jsonb_agg(to_jsonb(s) order by program_workout_id) from public.personal_programme_sessions s where assignment_id='${assignment}'`,
              id(1),
            ),
            originals,
          );
          assert.equal(
            sql(
              `select applied_adjustments->0->'personal_sessions'->0->'plan'->'movements'->0->'setRows'->0->>'weight' from public.programme_strength_week_reviews where id='${firstReview}'`,
              id(1),
            ),
            "19.57",
          );
          assert.equal(
            sql(
              `select current_workout_index from public.program_assignments where id='${assignment}'`,
              id(1),
            ),
            "0",
          );
          const before = snapshot();
          assert.throws(() => apply(), /changed elsewhere/);
          assert.equal(snapshot(), before);
          assert.equal(
            sql(
              `select app_private.personal_strength_review_plan(${json(sessions[0].plan)},${json(adjustments.map((a) => ({ ...a, personal_key: `${a.programme_key}:${a.exercise_id}`, load_adjustment_percent: a.exercise_id === id(10) ? -2.5 : 0 })))})->'movements'->0->'setRows'->0->>'weight'`,
              id(1),
            ),
            "20.09",
          );
        },
      );
      await t.test("starts the exact approved dose and locks that snapshot", () => {
        const savedToken = expectedReviewId;
        expectedReviewId = null;
        assert.throws(() => start(0), /review changed/);
        expectedReviewId = savedToken;
        firstPlan = start(0);
        firstSnapshot = prescription(firstPlan);
        assert.match(firstSnapshot, /19.57/);
        assert.match(firstSnapshot, /3 min/);
        assert.match(firstSnapshot, /double/);
        assert.match(firstSnapshot, new RegExp(firstReview));
        assert.equal(
          sql(
            `select count(*) from public.suggested_workout_sets s join public.suggested_workout_entries e on e.id=s.suggested_workout_entry_id where e.suggested_workout_id='${firstPlan}'`,
            id(1),
          ),
          "3",
        );
        assert.throws(
          () =>
            sql(
              `select public.save_personal_programme_sessions('${assignment}',${json([sessions[0]])})`,
              id(1),
            ),
          /already started/,
        );
        assert.throws(() => start(0), /already been started/);
        assert.equal(prescription(firstPlan), firstSnapshot);
      });
      let remainingReview: string;
      await t.test(
        "an explicit future edit expires the review while protecting started work",
        () => {
          const edited = {
            ...sessions[1],
            name: "Edited future session",
            plan: {
              ...sessions[1].plan,
              movements: sessions[1].plan.movements.map((movement) => ({
                ...movement,
                restTime: "4 min",
              })),
            },
          };
          sql(
            `select public.save_personal_programme_sessions('${assignment}',${json([edited])})`,
            id(1),
          );
          assert.equal(
            sql(
              `select status from public.programme_strength_week_reviews where id='${firstReview}'`,
              id(1),
            ),
            "superseded",
          );
          assert.equal(prescription(firstPlan), firstSnapshot);
          selected = [
            { workout_id: id(21), revision: 2 },
            { workout_id: id(22), revision: 1 },
          ];
          remainingReview = apply();
          expectedReviewId = remainingReview;
          assert.equal(
            sql(
              `select start_workout_index||':'||end_workout_index from public.programme_strength_week_reviews where id='${remainingReview}'`,
              id(1),
            ),
            "1:2",
          );
          assert.equal(
            sql(
              `select plan->'movements'->0->'setRows'->0->>'weight' from public.personal_programme_sessions where assignment_id='${assignment}' and program_workout_id='${id(21)}'`,
              id(1),
            ),
            "20.6",
          );
        },
      );
      await t.test(
        "completion advances once and week two applies against its own custom baseline",
        () => {
          complete(firstPlan, 0);
          const second = start(1, 2);
          assert.match(prescription(second), /4 min/);
          complete(second, 1);
          const third = start(2);
          complete(third, 2);
          assert.equal(
            sql(
              `select current_workout_index from public.program_assignments where id='${assignment}'`,
              id(1),
            ),
            "3",
          );
          current = 3;
          previous = remainingReview;
          selected = [3, 4, 5].map((i) => ({ workout_id: id(20 + i), revision: 1 }));
          const before = snapshot();
          // Fail after resolving the previous review to verify true transaction rollback.
          sql(`create function public.fail_test_review_insert() returns trigger language plpgsql as $$ begin raise exception 'Injected final insert failure'; end $$;
        create trigger fail_test_review_insert before insert on public.programme_strength_week_reviews for each row execute function public.fail_test_review_insert();`);
          assert.throws(() => apply(), /Injected final insert failure/);
          assert.equal(snapshot(), before);
          sql(
            "drop trigger fail_test_review_insert on public.programme_strength_week_reviews; drop function public.fail_test_review_insert()",
          );
          expectedReviewId = apply(
            adjustments.map((a) => ({
              ...a,
              load_adjustment_percent: a.exercise_id === id(10) ? -2.5 : 0,
              set_adjustment: 0,
            })),
            id(1),
            "hold",
          );
          const fourth = start(3);
          assert.match(prescription(fourth), /24.62/);
          assert.equal(
            sql(
              `select plan->'movements'->0->'setRows'->0->>'weight' from public.personal_programme_sessions where assignment_id='${assignment}' and program_workout_id='${id(23)}'`,
              id(1),
            ),
            "25.25",
          );
          assert.equal(prescription(firstPlan), firstSnapshot);
          assert.equal(
            sql("select count(*) from public.programme_strength_week_reviews", id(2)),
            "0",
          );
        },
      );
      await t.test(
        "restart copies original custom prescriptions rather than temporary reductions",
        () => {
          const restarted = sql(
            `select public.change_programme_run('${assignment}','restart','2026-10-26')`,
            id(1),
          );
          assert.equal(
            sql(
              `select plan->'movements'->0->'setRows'->0->>'weight' from public.personal_programme_sessions where assignment_id='${restarted}' and program_workout_id='${id(20)}'`,
              id(1),
            ),
            "20.6",
          );
          assert.equal(
            sql(
              `select jsonb_array_length(plan->'movements'->0->'setRows') from public.personal_programme_sessions where assignment_id='${restarted}' and program_workout_id='${id(20)}'`,
              id(1),
            ),
            "3",
          );
          assert.equal(
            sql(
              `select count(*) from public.programme_strength_week_reviews where program_assignment_id='${restarted}'`,
              id(1),
            ),
            "0",
          );
          const ordinaryStart = sql(
            `select public.start_personal_programme_session('${restarted}','${id(20)}',1,'${id(30)}')`,
            id(1),
          );
          assert.match(prescription(ordinaryStart), /20.6/);
          assert.equal(prescription(firstPlan), firstSnapshot);
          assert.equal(
            sql(
              `select count(*) from public.suggested_workouts where program_assignment_id='${assignment}' and status='completed'`,
              id(1),
            ),
            "3",
          );
        },
      );
      await t.test("cleans every test record and restores the exact baseline", () => {
        sql(
          "delete from public.suggested_workout_sets;delete from public.suggested_workout_entries;delete from public.suggested_workouts;delete from public.sessions;delete from public.program_assignments",
        );
        assert.equal(snapshot(), baseline);
      });
    } finally {
      db.close();
      assert.equal(existsSync(db.root), false);
    }
  },
);
