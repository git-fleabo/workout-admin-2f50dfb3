import test from "node:test";
import assert from "node:assert/strict";
import { temporaryPostgres, pgSkip } from "./helpers/temporary-postgres.ts";
test(
  "audit foreign-key indexes cover both relations without changing rows",
  { skip: pgSkip },
  () => {
    const db = temporaryPostgres();
    try {
      db.sql(`create table public.suggested_workouts(id int primary key);
      create table public.coaching_recommendation_decisions(id int primary key, suggested_workout_id int references public.suggested_workouts);
      create table public.mobility_practice_runs(id int, person_id int, primary key(id, person_id));
      create table public.sessions(id int primary key, mobility_practice_run_id int, person_id int, foreign key(mobility_practice_run_id,person_id) references public.mobility_practice_runs(id,person_id));
      insert into public.suggested_workouts select generate_series(1,5000);
      insert into public.coaching_recommendation_decisions select i,i from generate_series(1,5000) i;
      insert into public.mobility_practice_runs select i,i from generate_series(1,5000) i;
      insert into public.sessions select i,i,i from generate_series(1,5000) i;`);
      const snapshot = () =>
        db.sql(
          "select md5(string_agg(row_to_json(t)::text,'|' order by id)) from public.sessions t union all select md5(string_agg(row_to_json(t)::text,'|' order by id)) from public.coaching_recommendation_decisions t",
        );
      const before = snapshot();
      db.file(
        new URL(
          "../supabase/migrations/20261011215523_index_audit_foreign_keys.sql",
          import.meta.url,
        ),
      );
      db.file(
        new URL(
          "../supabase/migrations/20261011215523_index_audit_foreign_keys.sql",
          import.meta.url,
        ),
      );
      assert.equal(snapshot(), before);
      db.sql("analyze public.sessions; analyze public.coaching_recommendation_decisions;");
      assert.match(
        db.sql(
          "explain (costs off) select id from public.sessions where mobility_practice_run_id=7 and person_id=7",
        ),
        /sessions_mobility_practice_owner_idx/,
      );
      assert.match(
        db.sql(
          "explain (costs off) select id from public.coaching_recommendation_decisions where suggested_workout_id=7",
        ),
        /coaching_recommendation_decisions_suggested_workout_idx/,
      );
    } finally {
      db.close();
    }
  },
);
