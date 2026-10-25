import test from "node:test";
import assert from "node:assert/strict";
import { pgSkip, temporaryPostgres } from "./helpers/temporary-postgres.ts";
import { coachDatabaseMigrations } from "./helpers/coach-database-migrations.ts";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test(
  "rest days move only unstarted work, atomically, with safe Undo and profile isolation",
  { skip: pgSkip },
  async (t) => {
    const db = temporaryPostgres();
    const { sql } = db;
    try {
      db.file(new URL("./fixtures/personal-programme-database.sql", import.meta.url));
      db.file(new URL("./fixtures/coach-journey-database.sql", import.meta.url));
      sql(`alter table public.programs add column sessions_per_week integer default 3;
      alter table public.program_workouts add column week_number integer;
      alter table public.program_workouts add column day_number integer;
      insert into public.people values('${id(1)}'),('${id(2)}');
      insert into public.programs(id,is_template,method_type) values('${id(11)}',true,'jacked_dumbbell');
      insert into public.program_workouts(id,program_id,sequence_index,week_number,day_number) values
      ('${id(20)}','${id(11)}',1,1,1),('${id(21)}','${id(11)}',3,1,3),
      ('${id(22)}','${id(11)}',7,1,5),('${id(23)}','${id(11)}',10,2,1);`);
      for (const name of [
        ...coachDatabaseMigrations,
        "20261010115211_add_personal_strength_week_reviews.sql",
        "20261014202016_programme_schedule_shifts.sql",
        "20261025122109_training_rest_days.sql",
        "20261025123215_harden_training_rest_day_access.sql",
      ])
        db.file(new URL(`../supabase/migrations/${name}`, import.meta.url));
      sql(`insert into public.program_assignments(id,program_id,person_id,status,current_workout_index,started_on)
      values('${id(40)}','${id(11)}','${id(1)}','active',1,'2090-10-02');
      insert into public.sessions values('${id(90)}','${id(1)}',true);
      insert into public.suggested_workouts(id,person_id,program_assignment_id,program_workout_id,status,suggested_for,completed_session_id)
      values('${id(91)}','${id(1)}','${id(40)}','${id(20)}','completed','2090-10-02','${id(90)}');
      insert into public.suggested_workouts(id,person_id,program_assignment_id,program_workout_id,status,suggested_for)
      values('${id(92)}','${id(1)}','${id(40)}','${id(21)}','pending','2090-10-04');
      insert into public.suggested_workouts(id,person_id,status,suggested_for,title)
      values('${id(50)}','${id(1)}','pending','2090-10-04','Yoga');`);
      const apply = (
        date: string,
        rest = true,
        restore = true,
        person = id(1),
        role = "authenticated",
      ) =>
        sql(
          `select public.set_training_rest_day('${id(1)}','${date}',${rest},${restore})`,
          person,
          role,
        );
      const dates = () =>
        sql(`select string_agg(app_private.programme_session_scheduled_date('${id(40)}',id)::text,',' order by sequence_index)
      from public.program_workouts`);
      const original = dates();
      const assignment = sql(`select to_jsonb(a) from public.program_assignments a`);
      const completed = sql(
        `select to_jsonb(s) from public.suggested_workouts s where id='${id(91)}'`,
      );

      await t.test("rejects other profiles and anonymous writes", () => {
        assert.throws(() => apply("2090-10-04", true, true, id(2)), /Profile not found/);
        assert.throws(() => apply("2090-10-04", true, true, id(1), "anon"), /permission denied/);
        assert.equal(sql("select count(*) from public.training_rest_days"), "0");
      });
      await t.test("moves to next training day, preserving spacing and source/history", () => {
        assert.equal(apply("2090-10-04"), "4");
        assert.equal(dates(), "2090-10-02,2090-10-06,2090-10-08,2090-10-11");
        assert.equal(
          sql(`select suggested_for from public.suggested_workouts where id='${id(92)}'`),
          "2090-10-06",
        );
        assert.equal(
          sql(`select suggested_for from public.suggested_workouts where id='${id(50)}'`),
          "2090-10-05",
        );
        assert.equal(sql("select to_jsonb(a) from public.program_assignments a"), assignment);
        assert.equal(
          sql(`select to_jsonb(s) from public.suggested_workouts s where id='${id(91)}'`),
          completed,
        );
        assert.equal(apply("2090-10-04"), "0");
        assert.equal(sql("select count(*) from public.training_rest_days", id(2)), "0");
        assert.equal(apply("2090-10-04", false), "4");
        assert.equal(dates(), original);
      });
      await t.test("future rest shifts only sessions on and after that date", () => {
        assert.equal(apply("2090-10-06"), "2");
        assert.equal(dates(), "2090-10-02,2090-10-04,2090-10-09,2090-10-12");
        apply("2090-10-06", false);
      });
      await t.test("consecutive and existing future rest dates are skipped", () => {
        apply("2090-10-05");
        apply("2090-10-08");
        apply("2090-10-04");
        assert.equal(dates(), "2090-10-02,2090-10-06,2090-10-09,2090-10-12");
        assert.equal(
          sql(`select suggested_for from public.suggested_workouts where id='${id(50)}'`),
          "2090-10-06",
        );
        apply("2090-10-04", false);
        apply("2090-10-05", false);
        apply("2090-10-08", false);
        assert.equal(dates(), original);
      });
      await t.test("completed sessions and completed workout counts stay unchanged", () => {
        assert.equal(apply("2090-10-02"), "0");
        assert.equal(dates(), original);
        assert.equal(sql("select count(*) from public.sessions where completed"), "1");
        apply("2090-10-02", false);
      });
      await t.test("past rest rolls overdue unstarted work forward to today or later", () => {
        sql(
          `insert into public.suggested_workouts(id,person_id,status,suggested_for) values('${id(51)}','${id(1)}','pending','2020-01-01')`,
        );
        assert.equal(apply("2020-01-01"), "1");
        assert.equal(
          sql(
            `select suggested_for >= (now() at time zone 'Europe/London')::date from public.suggested_workouts where id='${id(51)}'`,
          ),
          "t",
        );
        apply("2020-01-01", false);
      });
      await t.test("Undo rejects workouts since started and can remove only the label", () => {
        apply("2090-10-04");
        sql(`update public.suggested_workouts set status='accepted' where id='${id(50)}'`);
        const shifted = dates();
        assert.throws(() => apply("2090-10-04", false), /changed or started/);
        assert.equal(dates(), shifted);
        assert.equal(sql("select count(*) from public.training_rest_days"), "1");
        assert.equal(apply("2090-10-04", false, false), "0");
        assert.equal(dates(), shifted);
        assert.equal(sql("select count(*) from public.training_rest_days"), "0");
        sql(`update public.suggested_workouts set status='pending',suggested_for='2090-10-04' where id='${id(50)}';
        update public.programme_session_dates set scheduled_on=case program_workout_id
          when '${id(21)}' then '2090-10-04'::date when '${id(22)}' then '2090-10-06'::date else '2090-10-09'::date end;
        update public.suggested_workouts set suggested_for='2090-10-04' where id='${id(92)}';`);
      });
      await t.test("Undo detects later manual date edits without partial writes", () => {
        apply("2090-10-04");
        sql(
          `update public.programme_session_dates set scheduled_on='2090-10-12' where program_workout_id='${id(23)}'`,
        );
        const shifted = dates();
        assert.throws(() => apply("2090-10-04", false), /changed or started/);
        assert.equal(dates(), shifted);
        apply("2090-10-04", false, false);
      });
      await t.test("a failed write rolls back both the marker and earlier shifts", () => {
        sql(`create function public.reject_rest_shift() returns trigger language plpgsql as $$ begin
        if new.program_workout_id='${id(23)}' then raise exception 'Test failure'; end if; return new; end $$;
        create trigger reject_rest_shift before insert or update on public.programme_session_dates
        for each row execute function public.reject_rest_shift();`);
        const before = dates();
        assert.throws(() => apply("2090-10-06"), /Test failure/);
        assert.equal(dates(), before);
        assert.equal(sql("select count(*) from public.training_rest_days"), "0");
      });
    } finally {
      db.close();
    }
  },
);
