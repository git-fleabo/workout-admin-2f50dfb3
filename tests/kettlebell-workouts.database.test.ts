import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pgSkip, temporaryPostgres, json, literal } from "./helpers/temporary-postgres.ts";
import { kbFixture, kbId as id } from "./helpers/kettlebell-fixtures.ts";
import { prepareKettlebellPilotImport } from "../scripts/prepare-kettlebell-import.ts";

test(
  "kettlebell catalogue transactions, isolation, snapshots and programme independence",
  { skip: pgSkip },
  async (t) => {
    const database = temporaryPostgres();
    const { sql, file } = database;
    try {
      file(new URL("./fixtures/personal-programme-database.sql", import.meta.url));
      sql(`alter table public.exercises add column is_active boolean default true;
      create table public.person_exercises(person_id uuid,exercise_id uuid,is_enabled boolean);
      create table public.equipment_items(id uuid primary key,person_id uuid,is_active boolean,circuit_group text);
      create table public.training_location_equipment(location_id uuid,equipment_item_id uuid);
      create table public.training_methods(id uuid primary key,person_id uuid,family text,is_active boolean);
      create table public.suggested_workout_method_blocks(id uuid primary key default gen_random_uuid(),suggested_workout_id uuid,training_method_id uuid,method_name text,family text,order_index integer,rounds integer,rest_between_movements_seconds integer,rest_between_rounds_seconds integer,block_duration_seconds integer,work_interval_seconds integer,rest_interval_seconds integer,config jsonb);
      create table public.suggested_workout_method_block_entries(block_id uuid,suggested_workout_entry_id uuid,sequence_index integer);
      grant select on public.person_exercises,public.equipment_items,public.training_location_equipment,public.training_methods to authenticated;
      grant select,insert on public.suggested_workout_method_blocks,public.suggested_workout_method_block_entries to authenticated;`);
      for (const name of [
        "20260716060735_complete_programme_workouts",
        "20261004142817_add_scheduled_training_plans",
        "20261004191240_add_programme_support_plans",
        "20261004193959_allow_programme_support_completion",
        "20261010142048_add_kettlebell_workout_catalogue",
      ]) {
        sql(readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8"));
      }
      sql(`insert into public.people values('${id(1)}'),('${id(2)}');
      insert into public.exercises(id) values('${id(10)}');
      insert into public.person_exercises values('${id(1)}','${id(10)}',true);
      insert into public.programs values('${id(11)}',true);
      insert into public.program_workouts values('${id(20)}','${id(11)}',0);
      insert into public.program_assignments(id,program_id,person_id,status,started_on,notes) values('${id(21)}','${id(11)}','${id(1)}','active','2026-10-01','Keep my plan'),('${id(22)}','${id(11)}','${id(1)}','paused','2026-10-02','Keep paused plan');
      insert into public.program_assignment_exercises(program_assignment_id,slot_key,exercise_id,exercise_name,training_max,is_enabled,load_adjustment_percent,manual_adjustment_percent)
        values('${id(21)}','press','${id(10)}','Programme press',24,true,2.5,0),('${id(22)}','press','${id(10)}','Paused press',20,true,0,-2.5);
      insert into public.training_locations values('${id(30)}','${id(1)}','gym',true),('${id(31)}','${id(2)}','gym',true);
      insert into public.equipment_items values('${id(40)}','${id(1)}',true,'kettlebell');
      insert into public.training_location_equipment values('${id(30)}','${id(40)}');
      insert into public.suggested_workouts(id,person_id,program_assignment_id,program_workout_id,training_location_id,status,title) values('${id(50)}','${id(1)}','${id(21)}','${id(20)}','${id(30)}','pending','Programme waiting');`);
      const w = kbFixture("conditioning");
      const insert = (value = w) =>
        sql(
          `insert into public.kettlebell_workouts(id,person_id,category,source_number,title,instructions,bell_count,verified,is_available,prescription) values('${value.id}','${id(1)}',${literal(value.category)},${value.sourceNumber},${literal(value.title)},${literal(value.instructions)},${value.bellCount},true,true,${json(value.prescription)})`,
          id(1),
        );
      insert();
      const prescriptionsBefore = sql(
        "select jsonb_agg(to_jsonb(e) order by program_assignment_id,slot_key) from public.program_assignment_exercises e",
      );
      const programmesBefore = sql(
        "select jsonb_agg(to_jsonb(a) order by id) from public.program_assignments a",
      );
      const otherBefore = sql(
        `select to_jsonb(w) from public.suggested_workouts w where id='${id(50)}'`,
      );
      const start = (request = id(60), version = 1, location = id(30), person = id(1), bell = 1) =>
        sql(
          `select public.start_kettlebell_workout('${w.id}',${version},'${location}',${bell},'${request}','2026-10-10')`,
          person,
        );
      await t.test(
        "private reads and invoker RPC reject another person and anonymous access",
        () => {
          assert.equal(sql("select count(*) from public.kettlebell_workouts", id(2)), "0");
          assert.throws(() => start(id(60), 1, id(30), id(2)), /unavailable/);
          assert.throws(
            () =>
              sql(
                `select public.start_kettlebell_workout('${w.id}',1,'${id(30)}',1,'${id(60)}','2026-10-10')`,
                id(1),
                "anon",
              ),
            /permission denied/,
          );
          assert.throws(
            () =>
              sql(
                `update public.kettlebell_workouts set person_id='${id(2)}' where id='${w.id}'`,
                id(1),
              ),
            /ownership cannot be changed/,
          );
        },
      );
      await t.test(
        "mobility, blank instructions, missing targets and invalid groups cannot be imported",
        () => {
          assert.throws(
            () =>
              sql(
                `update public.kettlebell_workouts set category='mobility' where id='${w.id}'`,
                id(1),
              ),
            /check constraint/,
          );
          assert.throws(
            () =>
              sql(
                `update public.kettlebell_workouts set instructions='' where id='${w.id}'`,
                id(1),
              ),
            /check constraint/,
          );
          const malformed = structuredClone(w.prescription);
          malformed.movements[0].setRows[0].reps = "";
          assert.throws(
            () =>
              sql(
                `update public.kettlebell_workouts set prescription=${json(malformed)} where id='${w.id}'`,
                id(1),
              ),
            /check constraint/,
          );
        },
      );
      await t.test(
        "stale, unsuitable equipment, other locations and disabled movements create no session",
        () => {
          assert.throws(() => start(id(60), 0), /changed/);
          assert.throws(() => start(id(60), 1, id(31)), /location/);
          sql(`update public.equipment_items set is_active=false where id='${id(40)}'`);
          assert.throws(() => start(), /equipment/);
          sql(
            `update public.equipment_items set is_active=true where id='${id(40)}'; update public.person_exercises set is_enabled=false`,
          );
          assert.throws(() => start(), /Enable the required exercises/);
          sql("update public.person_exercises set is_enabled=true");
          assert.equal(sql("select count(*) from public.suggested_workouts"), "1");
        },
      );
      const planId = start();
      await t.test(
        "acceptance preserves every programme and pending plan and is idempotent",
        () => {
          assert.equal(start(), planId);
          assert.equal(sql("select count(*) from public.suggested_workouts"), "2");
          assert.equal(
            sql(
              `select (program_assignment_id is null and program_workout_id is null and goal_id is null and mobility_practice_run_id is null)::text||':'||plan_kind from public.suggested_workouts where id='${planId}'`,
            ),
            "true:conditioning",
          );
          assert.equal(
            sql("select jsonb_agg(to_jsonb(a) order by id) from public.program_assignments a"),
            programmesBefore,
          );
          assert.equal(
            sql(`select to_jsonb(w) from public.suggested_workouts w where id='${id(50)}'`),
            otherBefore,
          );
          assert.equal(
            sql(
              `select string_agg(reps::text,',' order by set_number) from public.suggested_workout_sets s join public.suggested_workout_entries e on e.id=s.suggested_workout_entry_id where e.suggested_workout_id='${planId}'`,
            ),
            "5,4,3",
          );
          assert.match(
            sql(
              `select reason from public.suggested_workout_entries where suggested_workout_id='${planId}'`,
            ),
            /Test instructions/,
          );
          assert.throws(
            () =>
              sql(
                `update public.suggested_workouts set program_assignment_id='${id(21)}',program_workout_id='${id(20)}' where id='${planId}'`,
                id(1),
              ),
            /kettlebell_sessions_standalone/,
          );
        },
      );
      await t.test("versioned snapshots survive catalogue edits", () => {
        sql(
          `update public.kettlebell_workouts set instructions='New instructions' where id='${w.id}'`,
          id(1),
        );
        assert.equal(sql(`select version from public.kettlebell_workouts where id='${w.id}'`), "2");
        assert.match(
          sql(
            `select kettlebell_snapshot->>'instructions' from public.suggested_workouts where id='${planId}'`,
          ),
          /Test instructions/,
        );
        assert.equal(start(), planId);
        assert.throws(() => start(id(61), 1), /changed/);
      });
      await t.test(
        "completion does not alter any programme; completed requests cannot restart",
        () => {
          sql(`insert into public.sessions values('${id(70)}','${id(1)}',true)`);
          sql(`select * from public.complete_suggested_workout('${planId}','${id(70)}')`, id(1));
          assert.equal(
            sql(
              "select jsonb_agg(to_jsonb(e) order by program_assignment_id,slot_key) from public.program_assignment_exercises e",
            ),
            prescriptionsBefore,
          );
          assert.equal(
            sql("select jsonb_agg(to_jsonb(a) order by id) from public.program_assignments a"),
            programmesBefore,
          );
          assert.equal(
            sql(
              `select status||':'||completed_session_id from public.suggested_workouts where id='${planId}'`,
            ),
            `completed:${id(70)}`,
          );
          assert.throws(() => start(), /completed or cancelled/);
        },
      );
      await t.test("a method failure rolls back all entries and the accepted session", () => {
        const broken = structuredClone(w.prescription);
        broken.methodBlocks = [
          {
            trainingMethodId: id(80),
            methodName: "Missing test method",
            family: "timed_density",
            memberMovementIndexes: [0],
            rounds: "",
            restBetweenMovementsSeconds: "",
            restBetweenRoundsSeconds: "",
            blockDurationMinutes: "10",
            workIntervalSeconds: "30",
            restIntervalSeconds: "30",
            config: {},
          },
        ];
        sql(
          `update public.kettlebell_workouts set prescription=${json(broken)} where id='${w.id}'`,
          id(1),
        );
        assert.throws(() => start(id(62), 3), /training method is unavailable/);
        assert.equal(sql("select count(*) from public.suggested_workouts"), "2");
        assert.equal(sql("select count(*) from public.suggested_workout_entries"), "1");
      });
      await t.test("timed blocks and movement membership are saved intact", () => {
        sql(`insert into public.training_methods values('${id(80)}',null,'timed_density',true)`);
        const timed = structuredClone(w.prescription);
        timed.methodBlocks = [
          {
            trainingMethodId: id(80),
            methodName: "Original timed test",
            family: "timed_density",
            memberMovementIndexes: [0],
            rounds: "",
            restBetweenMovementsSeconds: "",
            restBetweenRoundsSeconds: "",
            blockDurationMinutes: "10",
            workIntervalSeconds: "30",
            restIntervalSeconds: "30",
            config: { side_rule: "alternate" },
          },
        ];
        sql(
          `update public.kettlebell_workouts set prescription=${json(timed)} where id='${w.id}'`,
          id(1),
        );
        const timedPlan = start(id(63), 4);
        assert.equal(
          sql(
            `select block_duration_seconds||':'||work_interval_seconds||':'||rest_interval_seconds||':'||(config->>'side_rule') from public.suggested_workout_method_blocks where suggested_workout_id='${timedPlan}'`,
          ),
          "600:30:30:alternate",
        );
        assert.equal(
          sql(
            `select count(*) from public.suggested_workout_method_block_entries be join public.suggested_workout_method_blocks b on b.id=be.block_id where b.suggested_workout_id='${timedPlan}'`,
          ),
          "1",
        );
        assert.equal(
          sql("select jsonb_agg(to_jsonb(a) order by id) from public.program_assignments a"),
          programmesBefore,
        );
      });
      await t.test(
        "the 15-record pilot import is repeatable and leaves accepted snapshots intact",
        () => {
          const pilot = {
            personId: id(1),
            workouts: (["strength", "muscle", "conditioning"] as const).flatMap((category) =>
              [1, 2, 3, 4, 5].map((number) => kbFixture(category, number)),
            ),
          };
          pilot.workouts[0].instructions = "It's an original test; '); select 1; --";
          const script = prepareKettlebellPilotImport(pilot);
          sql(script, id(1));
          sql(script, id(1));
          assert.equal(sql("select count(*) from public.kettlebell_workouts"), "15");
          assert.equal(sql("select count(*) from public.people"), "2");
          assert.equal(
            sql("select jsonb_agg(to_jsonb(a) order by id) from public.program_assignments a"),
            programmesBefore,
          );
          assert.match(
            sql(
              `select kettlebell_snapshot->>'instructions' from public.suggested_workouts where id='${planId}'`,
            ),
            /Test instructions/,
          );
        },
      );
    } finally {
      database.close();
    }
  },
);
