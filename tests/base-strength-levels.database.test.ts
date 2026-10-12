import test from "node:test";
import assert from "node:assert/strict";
import { temporaryPostgres, pgSkip, json } from "./helpers/temporary-postgres.ts";
import { coachDatabaseMigrations } from "./helpers/coach-database-migrations.ts";
import { buildBaseStrengthPersonalSessions } from "../src/lib/base-strength-personal.ts";
import {
  listBaseLevels,
  previewBaseLevels,
  type BaseLevelContext,
} from "../src/lib/base-strength-levels.ts";
import { DEFAULT_VOLUME_INTENSITY_OPTIONS } from "../src/lib/base-strength-preview.ts";
import {
  strengthId as id,
  strengthChoices,
  strengthTemplate,
} from "./helpers/base-strength-fixtures.ts";

test(
  "programme-wide base levels use the atomic save RPC and preserve source/history under stale and start races",
  { skip: pgSkip },
  async (t) => {
    const db = temporaryPostgres();
    const { sql } = db;
    try {
      for (const fixture of [
        "personal-programme-database.sql",
        "coach-journey-database.sql",
        "base-strength-database.sql",
      ])
        db.file(new URL(`./fixtures/${fixture}`, import.meta.url));
      for (const migration of [
        ...coachDatabaseMigrations,
        "20261010115211_add_personal_strength_week_reviews.sql",
        "20261010134112_add_base_strength_personal_programmes.sql",
      ])
        db.file(new URL(`../supabase/migrations/${migration}`, import.meta.url));
      sql(`insert into public.people values('${id(1)}'); insert into public.exercises select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(10,60) n;
      insert into public.sessions values('${id(6)}','${id(1)}',true);
      insert into public.session_entries(id,session_id,exercise_id,order_index) values('${id(7)}','${id(6)}','${id(10)}',0);
      insert into public.entry_sets(session_entry_id,set_number,reps,weight) values('${id(7)}',1,8,60);`);
      const template = strengthTemplate("volume_intensity");
      template.id = sql(
        "select id from public.programs where method_type='base_strength_volume_intensity' and duration_weeks=18",
      );
      const ids = JSON.parse(
        sql(
          `select jsonb_agg(id order by sequence_index) from public.program_workouts where program_id='${template.id}'`,
        ),
      ) as string[];
      template.workouts.forEach((workout, i) => {
        workout.id = ids[i];
      });
      const sessions = buildBaseStrengthPersonalSessions({
        programme: "volume_intensity",
        template,
        options: DEFAULT_VOLUME_INTENSITY_OPTIONS,
        choices: strengthChoices("volume_intensity"),
        startedOn: "2026-10-12",
        increment: 2.5,
        locationKind: "gym",
      });
      const assignmentId = sql(
        `select public.create_personal_programme('${id(1)}','${template.id}','My Volume/Intensity','2026-10-12',${json(sessions)})`,
        id(1),
      );
      sql(
        `update public.program_assignments set status='active',current_workout_index=1 where id='${assignmentId}'`,
        id(1),
      );
      sessions.forEach((session) => {
        session.revision = 1;
      });
      const c: BaseLevelContext = {
        template,
        lockedWorkoutIds: [],
        assignment: {
          id: assignmentId,
          status: "active",
          currentWorkoutIndex: 1,
          personalProgramme: { name: "My Volume/Intensity", sessions },
        } as BaseLevelContext["assignment"],
      };
      const save = (updates: typeof sessions) =>
        sql(
          `select public.save_personal_programme_sessions('${assignmentId}',${json(updates)})`,
          id(1),
        );
      const snapshot = () =>
        sql(
          `select jsonb_agg(to_jsonb(s) order by program_workout_id) from public.personal_programme_sessions s where assignment_id='${assignmentId}'`,
        );
      const protectedSnapshot = () =>
        sql(`select jsonb_build_object(
      'source',(select jsonb_agg(to_jsonb(p) order by id) from public.programs p),
      'workouts',(select jsonb_agg(to_jsonb(w) order by id) from public.program_workouts w),
      'past',(select to_jsonb(s) from public.personal_programme_sessions s where assignment_id='${assignmentId}' and program_workout_id='${ids[0]}'),
      'history',(select jsonb_agg(to_jsonb(s) order by id) from public.entry_sets s),
      'progress',(select current_workout_index from public.program_assignments where id='${assignmentId}'))`);
      const protectedBefore = protectedSnapshot();
      const level = listBaseLevels(c).find(
        (level) => level.role === "main" && level.phase === "base",
      )!;
      const preview = previewBaseLevels(c, { [level.key]: "120" });
      assert.ok(preview.updates.length > 1);
      const last = preview.updates.at(-1)!;
      await t.test("a stale later revision rolls back earlier writes in the same save", () => {
        sql(
          `update public.personal_programme_sessions set name='Changed elsewhere' where assignment_id='${assignmentId}' and program_workout_id='${last.workoutId}'`,
          id(1),
        );
        const before = snapshot();
        assert.throws(() => save(preview.updates), /changed elsewhere/);
        assert.equal(snapshot(), before);
        sql(
          `update public.personal_programme_sessions set name=${json(last.name)} #>> '{}' where assignment_id='${assignmentId}' and program_workout_id='${last.workoutId}'`,
          id(1),
        );
        // Tests refresh the snapshot after the unrelated edit rather than bypassing revisions.
        c.assignment.personalProgramme!.sessions.find(
          (s) => s.workoutId === last.workoutId,
        )!.revision = 3;
      });
      const refreshed = previewBaseLevels(c, { [level.key]: "120" });
      await t.test("a newly started later session also rolls back the whole save", () => {
        sql(
          `insert into public.suggested_workouts(person_id,program_assignment_id,program_workout_id,status) values('${id(1)}','${assignmentId}','${last.workoutId}','accepted')`,
          id(1),
        );
        const before = snapshot();
        assert.throws(() => save(refreshed.updates), /already started/);
        assert.equal(snapshot(), before);
        assert.equal(protectedSnapshot(), protectedBefore);
      });
      await t.test(
        "fresh preview excludes locked sessions and saves the remaining periodised loads",
        () => {
          c.lockedWorkoutIds = [last.workoutId];
          const fresh = previewBaseLevels(c, { [level.key]: "120" });
          assert.equal(Number(save(fresh.updates)), fresh.updates.length);
          for (const updated of fresh.updates) {
            const saved = JSON.parse(
              sql(
                `select plan from public.personal_programme_sessions where assignment_id='${assignmentId}' and program_workout_id='${updated.workoutId}'`,
                id(1),
              ),
            );
            assert.deepEqual(saved, updated.plan);
          }
          assert.equal(protectedSnapshot(), protectedBefore);
        },
      );
    } finally {
      db.close();
    }
  },
);
