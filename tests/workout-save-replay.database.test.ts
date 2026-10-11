import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { pgSkip, pgBin, temporaryPostgres, json } from "./helpers/temporary-postgres.ts";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test(
  "durable save receipts commit session and plan together and serialize replay",
  { skip: pgSkip },
  async (t) => {
    const db = temporaryPostgres();
    try {
      db.file(new URL("./fixtures/workout-correction-database.sql", import.meta.url));
      for (const migration of [
        "20260713142913_add_training_methods.sql",
        "20260713144239_add_session_method_blocks.sql",
        "20260713150451_add_entry_set_segments.sql",
        "20260713173600_add_timed_density_block_fields.sql",
        "20261011150503_correct_workout_atomically.sql",
      ])
        db.file(new URL(`../supabase/migrations/${migration}`, import.meta.url));
      const mobility = readFileSync(
        new URL(
          "../supabase/migrations/20260930112752_mobility_practice_pilot.sql",
          import.meta.url,
        ),
        "utf8",
      );
      db.sql(mobility.slice(mobility.indexOf("create function public.save_mobility_workout(")));
      db.sql(`create table public.programs(id uuid primary key);
      create table public.program_workouts(id uuid primary key,program_id uuid references public.programs,sequence_index integer);
      create table public.program_assignments(id uuid primary key,person_id uuid references public.people,program_id uuid references public.programs,current_workout_index integer,status text,completed_on date);
      alter table public.suggested_workouts add column program_assignment_id uuid references public.program_assignments;
      alter table public.suggested_workouts add column program_workout_id uuid references public.program_workouts;
      alter table public.suggested_workouts enable row level security;
      create policy plans_owner on public.suggested_workouts for all to authenticated using(app_private.person_is_accessible(person_id)) with check(app_private.person_is_accessible(person_id));
      alter table public.program_assignments enable row level security;
      create policy assignments_owner on public.program_assignments for all to authenticated using(app_private.person_is_accessible(person_id)) with check(app_private.person_is_accessible(person_id));
      grant select,update on public.suggested_workouts,public.program_assignments to authenticated;
      grant select on public.programs,public.program_workouts to authenticated;
      insert into public.people values('${id(1)}'),('${id(2)}');
      insert into public.activity_types(id,name,slug) values('${id(3)}','Strength','strength');
      insert into public.exercises values('${id(4)}','${id(3)}',true);
      insert into public.mobility_practice_runs values('${id(5)}','${id(1)}');
      insert into public.programs values('${id(6)}');
      insert into public.program_workouts values('${id(7)}','${id(6)}',0),('${id(8)}','${id(6)}',1);
      insert into public.program_assignments values('${id(9)}','${id(1)}','${id(6)}',0,'active',null);
      insert into public.suggested_workouts(id,person_id,status,program_assignment_id,program_workout_id) values
        ('${id(10)}','${id(1)}','accepted','${id(9)}','${id(7)}'),
        ('${id(11)}','${id(1)}','accepted','${id(9)}',null),
        ('${id(12)}','${id(2)}','accepted',null,null),
        ('${id(13)}','${id(1)}','dismissed',null,null),
        ('${id(14)}','${id(1)}','accepted','${id(9)}','${id(8)}');`);
      db.file(
        new URL(
          "../supabase/migrations/20261004193959_allow_programme_support_completion.sql",
          import.meta.url,
        ),
      );
      db.file(
        new URL("../supabase/migrations/20261011175107_save_workout_once.sql", import.meta.url),
      );
      const session = { session_date: "2026-10-11", title: "Replay test", completed: true };
      const entries = [
        {
          client_id: "press",
          name: "Press",
          activity_type_id: id(3),
          exercise_id: id(4),
          completed: true,
          sets: [{ set_number: 1, reps: 5, weight: 20 }],
        },
      ];
      const call = (
        operation: number,
        plan: number | null = null,
        mobilityId: number | null = null,
        body = session,
      ) =>
        `select public.save_workout_once('${id(operation)}','${id(1)}',${json(body)},${json(entries)},'[]',${plan ? `'${id(plan)}'` : "null"},${mobilityId ? `'${id(mobilityId)}'` : "null"})`;
      const counts = () =>
        db.sql(
          "select (select count(*) from public.sessions)||':'||(select count(*) from public.session_entries)||':'||(select count(*) from app_private.workout_save_operations)||':'||(select current_workout_index from public.program_assignments limit 1)",
        );

      await t.test(
        "two concurrent transactions and a lost-response retry save one session and advance strength once",
        async () => {
          const run = promisify(execFile);
          const args = [
            "-h",
            db.root,
            "-p",
            "54439",
            "-d",
            "postgres",
            "-X",
            "-A",
            "-t",
            "-q",
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
          ];
          const first = run(join(pgBin!, "psql"), [
            ...args,
            `set role authenticated;set request.jwt.claim.sub='${id(1)}';begin;${call(20, 10)};select pg_sleep(0.25);commit;`,
          ]);
          const second = run(join(pgBin!, "psql"), [
            ...args,
            `set role authenticated;set request.jwt.claim.sub='${id(1)}';${call(20, 10)};`,
          ]);
          const results = await Promise.all([first, second]);
          const saved = results[1].stdout.trim();
          assert.ok(results[0].stdout.includes(saved));
          assert.equal(db.sql(call(20, 10), id(1)), saved);
          assert.equal(counts(), "1:1:1:1");
          assert.equal(
            db.sql(
              `select completed_session_id from public.suggested_workouts where id='${id(10)}'`,
            ),
            saved,
          );
        },
      );
      await t.test(
        "support and standalone mobility preserve programme position and mobility association",
        () => {
          db.sql(call(21, 11), id(1));
          const saved = db.sql(call(22, null, 5), id(1));
          assert.equal(
            db.sql(`select mobility_practice_run_id from public.sessions where id='${saved}'`),
            id(5),
          );
          assert.equal(db.sql(call(22, null, 5), id(1)), saved);
          assert.equal(counts(), "3:3:3:1");
        },
      );
      await t.test("plan failures roll back the session, child rows and receipt", () => {
        const before = counts();
        for (const plan of [10, 12, 13]) assert.throws(() => db.sql(call(30 + plan, plan), id(1)));
        assert.equal(counts(), before);
        // The same key is reusable after a transaction definitively rolled back.
        db.sql(call(43, null), id(1));
        assert.equal(counts(), "4:4:4:1");
      });
      await t.test(
        "changed payload, anonymous access and wrong owner cannot reuse receipts",
        () => {
          const before = counts();
          assert.throws(
            () => db.sql(call(20, 10, null, { ...session, title: "Changed" }), id(1)),
            /different contents/,
          );
          assert.throws(() => db.sql(call(20, 10), id(2)), /not accessible/);
          assert.throws(() => db.sql(call(20, 10), id(1), "anon"), /permission denied/);
          assert.equal(
            db.sql("select count(*) from app_private.workout_save_operations", id(2)),
            "0",
          );
          assert.equal(counts(), before);
        },
      );
      await t.test(
        "deletion cannot resurrect a saved session and independent operations can finish the next strength session",
        () => {
          const saved = db.sql(call(22, null, 5), id(1));
          db.sql(`delete from public.sessions where id='${saved}'`, id(1));
          assert.throws(() => db.sql(call(22, null, 5), id(1)), /will not be recreated/);
          assert.equal(db.sql("select count(*) from public.sessions"), "3");
          const next = db.sql(call(50, 14), id(1));
          assert.equal(db.sql(call(50, 14), id(1)), next);
          assert.equal(
            db.sql("select current_workout_index||':'||status from public.program_assignments"),
            "2:complete",
          );
        },
      );
    } finally {
      db.close();
    }
  },
);
