import test from "node:test";
import assert from "node:assert/strict";
import { temporaryPostgres, pgSkip } from "./helpers/temporary-postgres.ts";
import { coachDatabaseMigrations } from "./helpers/coach-database-migrations.ts";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test(
  "strength review ownership is consistent for a manager with access to two profiles",
  { skip: pgSkip },
  async (t) => {
    const db = temporaryPostgres();
    try {
      db.file(new URL("./fixtures/personal-programme-database.sql", import.meta.url));
      db.file(new URL("./fixtures/coach-journey-database.sql", import.meta.url));
      db.sql(`create or replace function app_private.person_is_accessible(person_id uuid) returns boolean language sql stable as $$select person_id=auth.uid() or (auth.uid()='${id(9)}' and person_id in ('${id(1)}','${id(2)}'))$$;
      insert into public.people values('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}');
      insert into public.programs(id,is_template) values('${id(10)}',true);
      insert into public.program_workouts values('${id(11)}','${id(10)}',0);
      insert into public.program_assignments(id,program_id,person_id,status) values('${id(20)}','${id(10)}','${id(1)}','active'),('${id(21)}','${id(10)}','${id(2)}','active'),('${id(22)}','${id(10)}','${id(3)}','active');`);
      for (const migration of coachDatabaseMigrations.slice(0, -1))
        db.file(new URL(`../supabase/migrations/${migration}`, import.meta.url));
      const insert = (review: number, assignment: number, person: number) =>
        `insert into public.programme_strength_week_reviews(id,program_assignment_id,person_id,start_workout_index,end_workout_index,workout_ids,recovery_level,recommendation_kind,applied_adjustments) values('${id(review)}','${id(assignment)}','${id(person)}',0,0,array['${id(11)}'::uuid],'normal','keep','[]')`;
      // Reproduce the original manager-only hole before applying the repair.
      db.sql(insert(30, 20, 2), id(9));
      assert.equal(
        db.sql(`select person_id from public.programme_strength_week_reviews where id='${id(30)}'`),
        id(2),
      );
      db.sql(`delete from public.programme_strength_week_reviews where id='${id(30)}'`);
      db.file(new URL(`../supabase/migrations/${coachDatabaseMigrations.at(-1)}`, import.meta.url));
      await t.test(
        "valid reviews for either accessible profile remain available to the manager",
        () => {
          db.sql(insert(31, 20, 1), id(9));
          db.sql(insert(32, 21, 2), id(9));
          assert.equal(
            db.sql("select count(*) from public.programme_strength_week_reviews", id(9)),
            "2",
          );
          assert.equal(
            db.sql("select count(*) from public.programme_strength_week_reviews", id(1)),
            "1",
          );
        },
      );
      await t.test("manager inserts and updates cannot mix two accessible owners", () => {
        assert.throws(() => db.sql(insert(33, 20, 2), id(9)), /row-level security/);
        assert.throws(
          () =>
            db.sql(
              `update public.programme_strength_week_reviews set person_id='${id(2)}' where id='${id(31)}'`,
              id(9),
            ),
          /row-level security/,
        );
        assert.equal(
          db.sql(
            `select person_id from public.programme_strength_week_reviews where id='${id(31)}'`,
          ),
          id(1),
        );
      });
      await t.test(
        "inaccessible profiles are rejected and other owners' rows cannot be updated",
        () => {
          assert.throws(() => db.sql(insert(34, 22, 3), id(9)), /row-level security/);
          assert.equal(
            db.sql(
              `update public.programme_strength_week_reviews set status='resolved' where id='${id(32)}' returning id`,
              id(1),
            ),
            "",
          );
          assert.equal(
            db.sql(
              `select status from public.programme_strength_week_reviews where id='${id(32)}'`,
            ),
            "active",
          );
          assert.equal(
            db.sql("select count(*) from public.programme_strength_week_reviews", id(3)),
            "0",
          );
          assert.throws(
            () => db.sql("select * from public.programme_strength_week_reviews", id(1), "anon"),
            /permission denied/,
          );
        },
      );
      await t.test(
        "the composite foreign key protects privileged writes and assignment-owner changes",
        () => {
          assert.throws(() => db.sql(insert(35, 20, 2)), /foreign key constraint/);
          assert.throws(
            () =>
              db.sql(
                `update public.program_assignments set person_id='${id(4)}' where id='${id(20)}'`,
              ),
            /foreign key constraint/,
          );
          assert.equal(
            db.sql(`select person_id from public.program_assignments where id='${id(20)}'`),
            id(1),
          );
        },
      );
      await t.test(
        "valid status changes and assignment deletion preserve the established lifecycle",
        () => {
          db.sql(
            `update public.programme_strength_week_reviews set status='resolved' where id='${id(31)}'`,
            id(1),
          );
          assert.equal(
            db.sql(
              `select status from public.programme_strength_week_reviews where id='${id(31)}'`,
              id(1),
            ),
            "resolved",
          );
          db.sql(`delete from public.program_assignments where id='${id(20)}'`);
          assert.equal(
            db.sql(
              `select count(*) from public.programme_strength_week_reviews where id='${id(31)}'`,
            ),
            "0",
          );
        },
      );
    } finally {
      db.close();
    }
  },
);
