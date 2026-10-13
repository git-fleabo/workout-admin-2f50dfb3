import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pgSkip, temporaryPostgres, json } from "./helpers/temporary-postgres.ts";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test(
  "transactional correction preserves identity, rolls back completely and respects ownership",
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
      ])
        db.file(new URL(`../supabase/migrations/${migration}`, import.meta.url));
      const original = readFileSync(
        new URL(
          "../supabase/migrations/20260724162356_data_quality_foundations.sql",
          import.meta.url,
        ),
        "utf8",
      );
      db.sql(original.slice(original.indexOf("create or replace function public.save_workout(")));
      db.sql(
        original.slice(
          original.indexOf(
            "create or replace function app_private.validate_exercise_activity_pair()",
          ),
          original.indexOf(
            "create or replace function app_private.validate_reviewed_exercise_alias()",
          ),
        ),
      );
      db.file(
        new URL(
          "../supabase/migrations/20261011150503_correct_workout_atomically.sql",
          import.meta.url,
        ),
      );
      db.sql(`insert into public.people values('${id(1)}'),('${id(2)}');
      insert into public.activity_types(id,name,slug) values('${id(3)}','Strength','strength'),('${id(4)}','Climbing','climbing'),('${id(5)}','Mixed','mixed-training');
      insert into public.exercises values('${id(6)}','${id(3)}',true);
      insert into public.training_locations values('${id(7)}','${id(1)}');
      insert into public.mobility_practice_runs values('${id(8)}','${id(1)}');`);
      const segmentMethod = db.sql(
        "select id from public.training_methods where family='set_method' order by id limit 1",
      );
      const blockMethod = db.sql(
        "select id from public.training_methods where family='exercise_group' order by id limit 1",
      );
      const session = {
        session_date: "2026-10-11",
        title: "Original",
        completed: true,
        training_location_id: id(7),
      };
      const entries = [
        {
          client_id: "press",
          activity_type_id: id(3),
          exercise_id: id(6),
          name: "Press",
          completed: true,
          sets: [
            {
              set_number: 1,
              reps: 5,
              weight: 20,
              data_shape: "individual",
              load_semantics: "total_external_load",
              volume_status: "exact",
              segments: [
                {
                  training_method_id: segmentMethod,
                  method_name: "Test segment",
                  reps: 2,
                  weight: 10,
                },
              ],
            },
          ],
          metrics: [{ metric_key: "test", metric_value: 5 }],
        },
      ];
      const blocks = [
        {
          training_method_id: blockMethod,
          method_name: "Test group",
          family: "exercise_group",
          order_index: 0,
          member_client_ids: ["press"],
        },
      ];
      const saved = db.sql(
        `select public.save_workout('${id(1)}',${json(session)},${json(entries)},${json(blocks)})`,
        id(1),
      );
      db.sql(`update public.sessions set mobility_practice_run_id='${id(8)}',source_sheet='fixture',source_row=1 where id='${saved}';
      insert into public.suggested_workouts values('${id(9)}','${id(1)}','completed','${saved}');
      insert into public.program_workout_reviews values('${id(10)}','${saved}');`);
      const originalCreated = db.sql(`select created_at from public.sessions where id='${saved}'`);
      const corrected = { ...session, title: "Corrected", duration_minutes: 30 };
      const correctedEntries = [
        {
          ...entries[0],
          sets: [
            {
              set_number: 1,
              reps: 8,
              weight: 22.5,
              data_shape: "individual",
              load_semantics: "total_external_load",
              volume_status: "exact",
            },
          ],
          metrics: [{ metric_key: "test", metric_value: 8 }],
        },
        {
          client_id: "climb",
          activity_type_id: id(4),
          name: "Climbing",
          completed: true,
          sets: [],
          metrics: [{ metric_key: "minutes", metric_value: 10 }],
        },
      ];
      const call = (person = id(1), values = correctedEntries, methodBlocks = blocks) =>
        db.sql(
          `select public.correct_workout('${saved}','${person}',${json(corrected)},${json(values)},${json(methodBlocks)})`,
          person,
        );
      const snapshot = () =>
        db.sql(
          [
            "sessions",
            "session_entries",
            "entry_sets",
            "entry_metrics",
            "entry_set_segments",
            "session_method_blocks",
            "session_method_block_entries",
            "suggested_workouts",
            "program_workout_reviews",
          ]
            .map(
              (table) =>
                `select '${table}',md5(coalesce(string_agg(to_jsonb(r)::text,'' order by to_jsonb(r)::text),'')) from public.${table} r`,
            )
            .join(" union all "),
        );
      await t.test(
        "rejects another profile, missing IDs and anonymous calls without writes",
        () => {
          const before = snapshot();
          assert.throws(() => call(id(2)), /not found/);
          assert.throws(
            () =>
              db.sql(
                `select public.correct_workout(null,'${id(1)}',${json(corrected)},${json(correctedEntries)})`,
                id(1),
              ),
            /Missing workout/,
          );
          assert.throws(
            () =>
              db.sql(
                `select public.correct_workout('${saved}','${id(1)}',${json(corrected)},${json(correctedEntries)})`,
                id(1),
                "anon",
              ),
            /permission denied/,
          );
          assert.equal(snapshot(), before);
        },
      );
      await t.test("invalid entries and late block errors restore every old child and link", () => {
        const before = snapshot();
        assert.throws(
          () => call(id(1), [{ ...entries[0], exercise_id: id(99) }]),
          /invalid exercise/,
        );
        assert.throws(
          () => call(id(1), correctedEntries, [{ ...blocks[0], member_client_ids: ["missing"] }]),
          /unknown movement/,
        );
        assert.throws(
          () =>
            db.sql(
              `select public.correct_workout('${saved}','${id(1)}',${json(corrected)},null)`,
              id(1),
            ),
          /requires at least/,
        );
        assert.equal(snapshot(), before);
      });
      await t.test(
        "updates actual work while retaining plan, review, mobility and source links",
        () => {
          assert.equal(call(), saved);
          assert.equal(db.sql(`select count(*) from public.sessions`), "1");
          assert.equal(
            db.sql(
              `select title||':'||completed||':'||activity_type_id from public.sessions where id='${saved}'`,
            ),
            `Corrected:true:${id(5)}`,
          );
          assert.equal(
            db.sql(`select count(*) from public.session_entries where session_id='${saved}'`),
            "2",
          );
          assert.equal(db.sql(`select reps||':'||weight from public.entry_sets`), "8:22.5");
          assert.equal(db.sql("select count(*) from public.entry_set_segments"), "0");
          assert.equal(db.sql("select count(*) from public.session_method_block_entries"), "1");
          assert.equal(
            db.sql(`select completed_session_id||':'||status from public.suggested_workouts`),
            `${saved}:completed`,
          );
          assert.equal(db.sql("select session_id from public.program_workout_reviews"), saved);
          assert.equal(
            db.sql(
              `select mobility_practice_run_id||':'||source_sheet||':'||source_row from public.sessions`,
            ),
            `${id(8)}:fixture:1`,
          );
          assert.equal(db.sql(`select created_at from public.sessions`), originalCreated);
        },
      );
      await t.test(
        "retry after an uncertain response retains exactly one corrected session",
        () => {
          assert.equal(call(), saved);
          assert.equal(db.sql("select count(*) from public.sessions"), "1");
          assert.equal(db.sql("select count(*) from public.session_entries"), "2");
          assert.equal(db.sql("select count(*) from public.entry_sets"), "1");
        },
      );
      await t.test("the ordinary save signature still creates independent sessions", () => {
        const second = db.sql(
          `select public.save_workout('${id(1)}',${json(session)},${json(entries)})`,
          id(1),
        );
        assert.notEqual(second, saved);
        assert.equal(db.sql("select count(*) from public.sessions"), "2");
      });
      await t.test("a kettlebell summary saves and corrects without any fabricated sets", () => {
        const summarySession = {
          ...session,
          title: "KB summary",
          duration_minutes: 18,
          notes: "Weight used: 2 × 16 kg",
        };
        const summaryEntries = [
          {
            client_id: "summary",
            name: "KB summary",
            activity_type_id: id(3),
            completed: true,
            sets: [],
            notes: "Prescribed workout (reference only)",
            metrics: [
              { metric_key: "logging_mode", metric_text: "kettlebell_summary" },
              { metric_key: "weight_used", metric_text: "2 × 16 kg" },
            ],
          },
        ];
        const summaryId = db.sql(
          `select public.save_workout('${id(1)}',${json(summarySession)},${json(summaryEntries)},'[]'::jsonb)`,
          id(1),
        );
        assert.equal(
          db.sql(
            `select completed||':'||duration_minutes||':'||activity_type_id from public.sessions where id='${summaryId}'`,
          ),
          `true:18:${id(3)}`,
        );
        assert.equal(
          db.sql(
            `select count(*) from public.entry_sets s join public.session_entries e on e.id=s.session_entry_id where e.session_id='${summaryId}'`,
          ),
          "0",
        );
        assert.equal(
          db.sql(
            `select public.correct_workout('${summaryId}','${id(1)}',${json({ ...summarySession, duration_minutes: 16 })},${json(summaryEntries)},'[]'::jsonb)`,
            id(1),
          ),
          summaryId,
        );
        assert.equal(
          db.sql(`select duration_minutes from public.sessions where id='${summaryId}'`),
          "16",
        );
        assert.equal(
          db.sql(
            `select count(*) from public.entry_sets s join public.session_entries e on e.id=s.session_entry_id where e.session_id='${summaryId}'`,
          ),
          "0",
        );
        assert.equal(
          db.sql(`select completed_session_id||':'||status from public.suggested_workouts`),
          `${saved}:completed`,
        );
      });
    } finally {
      db.close();
    }
  },
);
