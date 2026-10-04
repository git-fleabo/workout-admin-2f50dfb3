import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pgBin = process.env.PERSONAL_PROGRAMME_PG_BIN;
const id = (last: number) => `00000000-0000-4000-8000-${String(last).padStart(12, "0")}`;
const literal = (value: unknown) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;
const plan = {
  version: 1,
  locationKind: "gym",
  movements: [
    {
      exerciseId: id(10),
      programmeKey: "press:0",
      exercise: "Press",
      workoutType: "Strength",
      trackingMode: "weight_reps",
      sourceDate: "",
      reason: "Deliberate targets",
      restTime: "2 min",
      targets: {
        durationMinutes: "",
        distance: "",
        distanceUnit: "",
        rounds: "",
        height: "",
        detail: "",
      },
      progression: { type: "double", minReps: 8, maxReps: 12, incrementKg: 1, maxRpe: 8 },
      setRows: [1, 2, 3].map(() => ({
        weight: "20",
        reps: "8",
        durationSeconds: "",
        rpe: "8",
        completed: true,
      })),
    },
  ],
};
const sessions = [0, 1, 2].map((index) => ({
  workoutId: id(20 + index),
  name: `Session ${index + 1}`,
  scheduledDate: `2026-10-0${5 + index * 2}`,
  revision: 1,
  plan: structuredClone(plan),
}));

test(
  "personal programme database lifecycle, concurrency guards and person isolation",
  { skip: !pgBin },
  async (t) => {
    const root = mkdtempSync(join(tmpdir(), "train-track-pg-"));
    const data = join(root, "data");
    const run = (binary: string, args: string[], input?: string) =>
      execFileSync(join(pgBin!, binary), args, {
        input,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    let started = false;
    const sql = (query: string, person?: string, role = "authenticated") =>
      run(
        "psql",
        [
          "-h",
          root,
          "-p",
          "54439",
          "-d",
          "postgres",
          "-X",
          "-q",
          "-A",
          "-t",
          "-v",
          "ON_ERROR_STOP=1",
        ],
        `${person ? `set role ${role}; set request.jwt.claim.sub=${literal(person)};` : ""}\n${query}`,
      ).trim();
    try {
      run("initdb", ["-D", data, "-A", "trust", "--no-locale"]);
      run("pg_ctl", [
        "-D",
        data,
        "-l",
        join(root, "log"),
        "-o",
        `-h '' -k ${root} -p 54439`,
        "-w",
        "start",
      ]);
      started = true;
      sql(
        readFileSync(
          new URL("./fixtures/personal-programme-database.sql", import.meta.url),
          "utf8",
        ),
      );
      sql(
        readFileSync(
          new URL(
            "../supabase/migrations/20260716060735_complete_programme_workouts.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      sql(
        readFileSync(
          new URL(
            "../supabase/migrations/20261004122209_editable_personal_programmes.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      sql(`insert into public.exercises values('${id(10)}'); insert into public.programs values('${id(11)}',true);
      insert into public.program_workouts values ${[0, 1, 2].map((i) => `('${id(20 + i)}','${id(11)}',${i})`).join(",")};
      insert into public.training_locations values('${id(30)}','${id(1)}','gym',true),('${id(31)}','${id(2)}','gym',true);`);
      const assignment = sql(
        `select public.create_personal_programme('${id(1)}','${id(11)}','My block','2026-10-05',${json(sessions)},'My notes')`,
        id(1),
      );
      const save = (updates: unknown[], person = id(1)) =>
        sql(
          `select public.save_personal_programme_sessions('${assignment}',${json(updates)})`,
          person,
        );
      const start = (workout = id(20), revision = 2, location = id(30)) =>
        sql(
          `select public.start_personal_programme_session('${assignment}','${workout}',${revision},'${location}')`,
          id(1),
        );
      const changed = structuredClone(sessions[0]);
      changed.plan.movements[0].setRows.forEach((s) => (s.weight = "22"));
      await t.test("creates an editable draft and preserves notes", () => {
        assert.equal(
          sql(
            `select status||':'||notes from public.program_assignments where id='${assignment}'`,
            id(1),
          ),
          "paused:My notes",
        );
        assert.equal(save([changed]), "1");
        assert.equal(
          sql(
            `select revision from public.personal_programme_sessions where assignment_id='${assignment}' and program_workout_id='${id(20)}'`,
            id(1),
          ),
          "2",
        );
      });
      await t.test("rejects stale edits and rolls back an entire mixed batch", () => {
        assert.throws(() => save([changed]), /changed elsewhere/);
        assert.throws(() => save([sessions[1], changed]), /changed elsewhere/);
        assert.equal(
          sql(
            `select revision from public.personal_programme_sessions where assignment_id='${assignment}' and program_workout_id='${id(21)}'`,
            id(1),
          ),
          "1",
        );
        const malformed = structuredClone(sessions[1]);
        delete (malformed.plan as Partial<typeof plan>).version;
        assert.throws(() => save([malformed]), /Choose a location/);
      });
      await t.test("requires explicit targets before activating a draft", () => {
        const blank = structuredClone(sessions[1]);
        blank.plan.movements[0].setRows[0].reps = "";
        save([blank]);
        assert.throws(
          () =>
            sql(
              `update public.program_assignments set status='active' where id='${assignment}'`,
              id(1),
            ),
          /Fill in future set targets/,
        );
        save([{ ...sessions[1], revision: 2 }]);
        sql(
          `update public.program_assignments set status='active' where id='${assignment}'`,
          id(1),
        );
      });
      let snapshot = "";
      await t.test("starts only the next current revision and saves its exact prescription", () => {
        assert.throws(() => start(id(21), 3), /no longer the next/);
        assert.throws(() => start(id(20), 1), /session changed/);
        assert.throws(
          () =>
            sql(
              `select public.start_personal_programme_session('${assignment}','${id(20)}',null,'${id(30)}')`,
              id(1),
            ),
          /session changed/,
        );
        assert.throws(() => start(id(20), 2, id(31)), /available training location/);
        snapshot = start();
        assert.equal(
          sql(
            `select weight::text||':'||reps::text from public.suggested_workout_sets s join public.suggested_workout_entries e on e.id=s.suggested_workout_entry_id where e.suggested_workout_id='${snapshot}' order by set_number`,
            id(1),
          ),
          "22:8\n22:8\n22:8",
        );
        assert.equal(
          sql(
            `select target_metrics->>'rest_time'||':'||(target_metrics->'progression'->>'type') from public.suggested_workout_entries where suggested_workout_id='${snapshot}'`,
            id(1),
          ),
          "2 min:double",
        );
        assert.throws(() => start(), /already been started/);
        assert.throws(() => save([{ ...changed, revision: 2 }]), /already started/);
      });
      await t.test("isolates another person's reads, edits and anonymous RPC access", () => {
        assert.equal(sql(`select count(*) from public.personal_programmes`, id(2)), "0");
        assert.equal(sql(`select count(*) from public.personal_programme_sessions`, id(2)), "0");
        assert.throws(() => save([sessions[2]], id(2)), /cannot be edited/);
        assert.throws(
          () =>
            sql(
              `select public.create_personal_programme('${id(1)}','${id(11)}','Intruder','2026-10-05',${json(sessions)})`,
              id(2),
            ),
          /not accessible/,
        );
        assert.throws(
          () =>
            sql(
              `select public.start_personal_programme_session('${assignment}','${id(20)}',2,'${id(30)}')`,
              id(2),
              "anon",
            ),
          /permission denied/,
        );
      });
      await t.test(
        "future edits and swaps preserve sequence dates and the started snapshot",
        () => {
          const future = structuredClone(sessions[1]);
          future.revision = 3;
          const blank = structuredClone(future);
          blank.plan.movements[0].setRows[0].reps = "";
          assert.throws(() => save([blank]), /Fill in future set targets/);
          future.plan.movements[0].setRows.forEach((set) => (set.weight = "24"));
          save([future]);
          save([
            { ...future, revision: 4, name: sessions[2].name, plan: sessions[2].plan },
            { ...sessions[2], name: future.name, plan: future.plan },
          ]);
          assert.equal(
            sql(
              `select name||':'||scheduled_on::text||':'||(plan->'movements'->0->'setRows'->0->>'weight') from public.personal_programme_sessions where assignment_id='${assignment}' and program_workout_id='${id(21)}'`,
              id(1),
            ),
            "Session 3:2026-10-07:20",
          );
          assert.equal(
            sql(
              `select weight from public.suggested_workout_sets s join public.suggested_workout_entries e on e.id=s.suggested_workout_entry_id where e.suggested_workout_id='${snapshot}' order by set_number limit 1`,
              id(1),
            ),
            "22",
          );
        },
      );
      await t.test(
        "completion advances once and restart retains the old snapshot and history",
        () => {
          sql(`insert into public.sessions values('${id(40)}','${id(1)}',true)`);
          sql(`select * from public.complete_suggested_workout('${snapshot}','${id(40)}')`, id(1));
          sql(`select * from public.complete_suggested_workout('${snapshot}','${id(40)}')`, id(1));
          assert.equal(
            sql(
              `select current_workout_index from public.program_assignments where id='${assignment}'`,
              id(1),
            ),
            "1",
          );
          assert.throws(() => save([{ ...changed, revision: 2 }]), /Only future sessions/);
          const next = sql(
            `select public.change_programme_run('${assignment}','restart','2026-11-02')`,
            id(1),
          );
          assert.equal(
            sql(
              `select status||':'||completed_session_id::text from public.suggested_workouts where id='${snapshot}'`,
              id(1),
            ),
            `completed:${id(40)}`,
          );
          assert.equal(
            sql(
              `select count(*) from public.personal_programme_sessions where assignment_id='${next}'`,
              id(1),
            ),
            "3",
          );
          assert.equal(
            sql(
              `select scheduled_on from public.personal_programme_sessions where assignment_id='${next}' and program_workout_id='${id(20)}'`,
              id(1),
            ),
            "2026-11-02",
          );
          assert.equal(
            sql(
              `select plan->'movements'->0->'setRows'->0->>'weight' from public.personal_programme_sessions where assignment_id='${next}' and program_workout_id='${id(20)}'`,
              id(1),
            ),
            "22",
          );
          const easier = sql(
            `select public.start_personal_programme_session('${next}','${id(20)}',1,'${id(30)}',true)`,
            id(1),
          );
          assert.equal(
            sql(
              `select count(*)||':'||min(weight)::text from public.suggested_workout_sets s join public.suggested_workout_entries e on e.id=s.suggested_workout_entry_id where e.suggested_workout_id='${easier}'`,
              id(1),
            ),
            "2:19.80",
          );
          assert.equal(
            sql(
              `select status||':'||current_workout_index::text from public.program_assignments where id='${assignment}'`,
              id(1),
            ),
            "archived:1",
          );
        },
      );
    } finally {
      if (started) run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
      rmSync(root, { recursive: true, force: true });
    }
  },
);
