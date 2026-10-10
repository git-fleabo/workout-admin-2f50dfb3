import test from "node:test";
import assert from "node:assert/strict";
import { temporaryPostgres, pgSkip } from "./helpers/temporary-postgres.ts";

test(
  "extra exercise categories persist atomically with existing Library admin access",
  { skip: pgSkip },
  () => {
    const db = temporaryPostgres();
    try {
      db.sql(`create role anon; create role authenticated; create schema auth; create schema app_private;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function app_private.current_person_is_admin() returns boolean language sql as $$ select auth.uid()='00000000-0000-4000-8000-000000000001'::uuid $$;
      grant usage on schema public,auth,app_private to authenticated,anon;
      create table public.activity_types(id uuid primary key,name text unique);
      create table public.exercises(id uuid primary key,activity_type_id uuid references public.activity_types);
      grant select,update on public.exercises to authenticated;
      grant select on public.activity_types to authenticated;
      insert into public.activity_types values('00000000-0000-4000-8000-000000000010','Conditioning'),('00000000-0000-4000-8000-000000000011','Strength'),('00000000-0000-4000-8000-000000000012','Power');
      insert into public.exercises values('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000010');`);
      db.file(
        new URL(
          "../supabase/migrations/20261010212137_add_exercise_categories.sql",
          import.meta.url,
        ),
      );
      const admin = "00000000-0000-4000-8000-000000000001";
      const other = "00000000-0000-4000-8000-000000000002";
      const save = (names: string, person = admin) =>
        db.sql(
          `select public.set_exercise_categories('00000000-0000-4000-8000-000000000020',${names});`,
          person,
        );
      const categories = () =>
        db.sql(
          "select string_agg(a.name,',' order by a.name) from public.exercise_activity_types t join public.activity_types a on a.id=t.activity_type_id",
          admin,
        );
      save("array['Conditioning','Strength',' Strength ']");
      assert.equal(categories(), "Strength");
      assert.equal(
        db.sql(
          "select a.name from public.exercises e join public.activity_types a on a.id=e.activity_type_id",
          admin,
        ),
        "Conditioning",
      );
      assert.throws(() => save("array['Power','Missing']"), /category changed/);
      assert.equal(categories(), "Strength");
      assert.throws(() => save("array['Power']", other), /administrators/);
      assert.throws(
        () =>
          db.sql(
            "insert into public.exercise_activity_types(exercise_id,activity_type_id) values('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000012')",
            other,
          ),
        /row-level security/,
      );
      assert.equal(db.sql("select count(*) from public.exercise_activity_types", other), "1");
      assert.throws(
        () =>
          db.sql(
            "select public.set_exercise_categories('00000000-0000-4000-8000-000000000020',array['Power'])",
            admin,
            "anon",
          ),
        /permission denied/,
      );
      save("array['Power']");
      assert.equal(categories(), "Power");
      save("array[]::text[]");
      assert.equal(categories(), "");
      assert.equal(
        db.sql("select prosecdef from pg_proc where proname='set_exercise_categories'"),
        "f",
      );
    } finally {
      db.close();
    }
  },
);
