import { coachDatabaseMigrations as migrations } from "./helpers/coach-database-migrations.ts";
import { buildWeeklyPlan } from "../src/lib/weekly-plan.ts";
import {
  buildWeeklyCoachDraft,
  type WeeklyCoachDraftCandidate,
} from "../src/lib/weekly-coach-draft.ts";
import { saveReviewedWeeklyCoachDraft } from "../src/lib/save-weekly-coach-draft.ts";
import type { ProgrammeScheduleSession } from "../src/lib/supabase-programmes.browser.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { pgSkip, temporaryPostgres, json } from "./helpers/temporary-postgres.ts";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
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
      reason: "Test targets",
      restTime: "2 min",
      targets: {
        durationMinutes: "",
        distance: "",
        distanceUnit: "",
        rounds: "",
        height: "",
        detail: "",
      },
      progression: { type: "fixed", minReps: 8, maxReps: 12, incrementKg: 1, maxRpe: 8 },
      setRows: [{ weight: "20", reps: "8", durationSeconds: "", rpe: "", completed: true }],
    },
  ],
};

test("isolated two-week programme and adaptive coach journey", { skip: pgSkip }, async (t) => {
  const db = temporaryPostgres();
  const { sql } = db;
  try {
    db.file(new URL("./fixtures/personal-programme-database.sql", import.meta.url));
    db.file(new URL("./fixtures/coach-journey-database.sql", import.meta.url));
    for (const migration of migrations)
      db.file(new URL(`../supabase/migrations/${migration}`, import.meta.url));
    // Production templates start at one. Gaps must still count as one position.
    sql(`insert into public.people values('${id(1)}'),('${id(2)}');
      insert into public.exercises values('${id(10)}');
      insert into public.programs(id,is_template) values('${id(11)}',true);
      insert into public.program_workouts(id,program_id,sequence_index) values
        ${[1, 2, 3, 7, 8, 9].map((sequence, i) => `('${id(20 + i)}','${id(11)}',${sequence})`).join(",")};
      insert into public.training_locations values('${id(30)}','${id(1)}','gym',true);
      insert into public.goals values('${id(60)}','${id(1)}','active','${id(10)}');
      insert into public.mobility_practice_runs values('${id(61)}','${id(1)}','active');`);
    const tables = [
      "program_assignments",
      "personal_programmes",
      "personal_programme_sessions",
      "program_assignment_exercises",
      "sessions",
      "suggested_workouts",
      "suggested_workout_entries",
      "suggested_workout_sets",
      "coaching_preferences",
      "coaching_recommendation_decisions",
      "coaching_recommendation_outcomes",
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
    const sessions = [0, 1, 2, 3, 4, 5].map((i) => ({
      workoutId: id(20 + i),
      name: `Test session ${i + 1}`,
      scheduledDate: `2026-10-${12 + i * 2}`,
      revision: 1,
      plan,
    }));
    const assignment = sql(
      `select public.create_personal_programme('${id(1)}','${id(11)}','Disposable two-week test','2026-10-12',${json(sessions)})`,
      id(1),
    );
    const decision = (key: string, date: string, chosen: string | null, verdict = "accepted") =>
      sql(
        `select public.decide_coaching_recommendation_v3('move_session','${key}','${id(63)}','2026-10-12','${date}','2026-10-14',${chosen ? `'${chosen}'` : "null"},'${verdict}','Separate optional practice','{}')`,
        id(1),
      );
    await t.test("creates a future-dated paused copy and explicitly activates it", () => {
      assert.equal(
        sql(
          `select status||':'||started_on from public.program_assignments where id='${assignment}'`,
          id(1),
        ),
        "paused:2026-10-12",
      );
      sql(
        `update public.program_assignments set status='active' where id='${assignment}';
        insert into public.coaching_preferences(person_id,weekly_training_days,weekly_minutes,max_demanding_days,secondary_focus_ids)
        values('${id(1)}',4,300,3,array['goal:${id(60)}']);`,
        id(1),
      );
      sql(
        `insert into public.suggested_workouts(id,person_id,program_assignment_id,training_location_id,status,title,suggested_for,plan_kind,goal_id)
        values('${id(63)}','${id(1)}','${assignment}','${id(30)}','pending','Skill practice','2026-10-12','skill','${id(60)}');
        insert into public.suggested_workout_entries(id,suggested_workout_id,exercise_id,name,tracking_mode) values('${id(70)}','${id(63)}','${id(10)}','Skill','reps_only');
        insert into public.suggested_workout_sets(suggested_workout_entry_id,set_number,reps,completed) values('${id(70)}',1,5,true),('${id(70)}',2,5,true);`,
        id(1),
      );
    });
    await t.test("records rejection without applying it, then an edited acceptance", () => {
      const rejected = decision("rejected", "2026-10-12", null, "rejected");
      assert.equal(
        sql(`select suggested_for from public.suggested_workouts where id='${id(63)}'`, id(1)),
        "2026-10-12",
      );
      assert.throws(
        () =>
          sql(`select public.record_coaching_recommendation_outcome('${rejected}','right')`, id(1)),
        /unavailable/,
      );
      decision("accepted", "2026-10-12", "2026-10-13");
      assert.equal(
        sql(
          `select proposed_date||':'||chosen_date from public.coaching_recommendation_decisions where recommendation_key='accepted'`,
          id(1),
        ),
        "2026-10-14:2026-10-13",
      );
    });
    await t.test("rejects stale decisions and atomically rolls back a failed write", () => {
      const before = snapshot();
      assert.throws(() => decision("stale", "2026-10-12", "2026-10-14"), /out of date/);
      // The RPC updates the workout first; the oversized key makes its insert fail.
      assert.throws(
        () => decision("x".repeat(201), "2026-10-13", "2026-10-14"),
        /check constraint/,
      );
      assert.equal(snapshot(), before);
    });
    await t.test("completes support, records an outcome, and never advances strength", () => {
      const accepted = sql(
        `select id from public.coaching_recommendation_decisions where recommendation_key='accepted'`,
        id(1),
      );
      assert.throws(
        () =>
          sql(`select public.record_coaching_recommendation_outcome('${accepted}','right')`, id(1)),
        /Complete the reviewed session/,
      );
      sql(`insert into public.sessions values('${id(64)}','${id(1)}',true)`, id(1));
      sql(`select * from public.complete_suggested_workout('${id(63)}','${id(64)}')`, id(1));
      assert.equal(
        sql(
          `select current_workout_index from public.program_assignments where id='${assignment}'`,
          id(1),
        ),
        "0",
      );
      sql(`select public.record_coaching_recommendation_outcome('${accepted}','right')`, id(1));
      assert.equal(
        sql("select outcome_rating from public.coaching_recommendation_outcomes", id(1)),
        "right",
      );
      assert.equal(sql("select count(*) from public.coaching_recommendation_outcomes", id(2)), "0");
      assert.throws(
        () =>
          sql(
            `select public.record_coaching_recommendation_outcome('${accepted}','too_easy')`,
            id(2),
          ),
        /unavailable/,
      );
    });
    await t.test("denies foreign-person preference, decision and anonymous access", () => {
      assert.equal(sql("select count(*) from public.coaching_preferences", id(2)), "0");
      assert.equal(
        sql("select count(*) from public.coaching_recommendation_decisions", id(2)),
        "0",
      );
      assert.throws(
        () => sql(`insert into public.coaching_preferences(person_id) values('${id(1)}')`, id(2)),
        /row-level security/,
      );
      assert.throws(
        () =>
          sql(
            `select public.decide_coaching_recommendation_v3('move_session','intruder','${id(63)}','2026-10-12','2026-10-13','2026-10-14','2026-10-14','accepted','Test','{}')`,
            id(2),
          ),
        /out of date/,
      );
      assert.throws(
        () => sql(`select app_private.programme_workout_position('${id(20)}')`, id(2), "anon"),
        /permission denied/,
      );
    });
    await t.test(
      "week two advances by positions, protects prior sessions and preserves exact snapshots",
      () => {
        for (let i = 0; i < 3; i++) {
          const started = sql(
            `select public.start_personal_programme_session('${assignment}','${id(20 + i)}',1,'${id(30)}')`,
            id(1),
          );
          sql(`insert into public.sessions values('${id(80 + i)}','${id(1)}',true)`, id(1));
          sql(
            `select * from public.complete_suggested_workout('${started}','${id(80 + i)}')`,
            id(1),
          );
        }
        assert.equal(
          sql(
            `select current_workout_index from public.program_assignments where id='${assignment}'`,
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
          /Only future sessions/,
        );
        assert.equal(sql(`select app_private.programme_workout_position('${id(23)}')`, id(1)), "3");
        const weekTwo = sql(
          `select public.start_personal_programme_session('${assignment}','${id(23)}',1,'${id(30)}')`,
          id(1),
        );
        assert.equal(
          sql(
            `select reps||':'||weight from public.suggested_workout_sets s join public.suggested_workout_entries e on e.id=s.suggested_workout_entry_id where e.suggested_workout_id='${weekTwo}'`,
            id(1),
          ),
          "8:20",
        );
        assert.throws(
          () =>
            sql(`select public.choose_next_programme_session('${assignment}','${id(25)}')`, id(1)),
          /Finish or discard/,
        );
        sql(`update public.suggested_workouts set status='archived' where id='${weekTwo}'`, id(1));
        assert.equal(
          sql(`select public.choose_next_programme_session('${assignment}','${id(25)}')`, id(1)),
          "2",
        );
        assert.equal(
          sql(
            `select current_workout_index from public.program_assignments where id='${assignment}'`,
            id(1),
          ),
          "5",
        );
        assert.equal(
          sql(
            `select count(*) from public.suggested_workouts where program_assignment_id='${assignment}' and program_workout_id is not null and status='completed'`,
            id(1),
          ),
          "3",
        );
      },
    );
    await t.test(
      "applies a bounded strength review to one-based and gapped template positions",
      () => {
        sql(`update public.program_assignments set status='paused' where id='${assignment}';
        insert into public.program_assignments(id,person_id,program_id,status,started_on) values('${id(90)}','${id(1)}','${id(11)}','active','2026-10-12');
        insert into public.program_assignment_exercises(id,program_assignment_id,exercise_name,is_enabled,load_adjustment_percent,manual_adjustment_percent)
        values('${id(91)}','${id(90)}','Press',true,0,0);`);
        const adjustments = [
          {
            exercise_id: id(91),
            manual_adjustment_percent: -2.5,
            combined_adjustment_percent: -2.5,
            set_adjustment: -1,
          },
        ];
        const apply = (person = id(1)) =>
          sql(
            `select public.apply_programme_strength_week_review('${id(90)}',1,0,2,array['${id(20)}','${id(21)}','${id(22)}']::uuid[],'deload','reduce',${json(adjustments)})`,
            person,
          );
        assert.throws(() => apply(id(2)), /not found/);
        apply();
        assert.equal(
          sql(
            "select start_workout_index||':'||end_workout_index||':'||(applied_adjustments->0->>'set_adjustment') from public.programme_strength_week_reviews",
            id(1),
          ),
          "0:2:-1",
        );
        const before = snapshot();
        assert.throws(
          () =>
            sql(
              `select public.apply_programme_strength_week_review('${id(90)}',1,0,2,array['${id(20)}','${id(21)}','${id(23)}']::uuid[],'deload','reduce',${json(adjustments)})`,
              id(1),
            ),
          /range/,
        );
        assert.equal(snapshot(), before);
      },
    );
    await t.test(
      "rejects a stale draft, compensates partial saves, and retains edited dates",
      async () => {
        const week = buildWeeklyPlan({ home: [], gym: [] }, "2026-10-12");
        const preferences = {
          primaryFocusId: "programme",
          secondaryFocusIds: [`goal:${id(60)}`, "mobility:shoulder"],
          maintenanceFocusIds: [],
          weeklyTrainingDays: 4,
          weeklyMinutes: 300,
          maxDemandingDays: 3,
          saved: true,
        };
        const candidates: WeeklyCoachDraftCandidate[] = ["skill", "mobility"].map((kind) => ({
          focusId: kind === "skill" ? `goal:${id(60)}` : "mobility:shoulder",
          sourceId: kind,
          kind: kind as "skill" | "mobility",
          title: kind,
          defaultPlacement: "either",
          draft: { version: 1, title: kind, locationKind: "gym", basis: "Test", movements: [] },
          planKind: kind as "skill" | "mobility",
          goalId: kind === "skill" ? id(60) : null,
          mobilityRunId: kind === "mobility" ? id(61) : null,
          programAssignmentId: null,
          estimatedMinutes: 15,
        }));
        const programme = [
          {
            assignmentId: id(90),
            programWorkoutId: id(20),
            date: "2026-10-12",
            programmeName: "Strength",
            workoutName: "A",
            movementNames: [],
            movements: [],
            status: "current",
          },
        ] as ProgrammeScheduleSession[];
        const rebuild = () =>
          buildWeeklyCoachDraft({
            plan: week,
            programmeSessions: programme,
            scheduledPlans: [],
            preferences: {
              ...preferences,
              weeklyMinutes: Number(
                sql("select weekly_minutes from public.coaching_preferences", id(1)),
              ),
            },
            candidates,
            today: week.startDate,
          });
        const reviewed = rebuild();
        assert.equal(reviewed.additions.length, 2);
        const edited = reviewed.additions.map((addition, i) => ({
          ...addition,
          date: i === 0 ? "2026-10-12" : "2026-10-14",
        }));
        let calls = 0;
        const save = async (addition: (typeof edited)[number]) => {
          const workout = id(110 + calls++);
          sql(
            `insert into public.suggested_workouts(id,person_id,training_location_id,status,title,suggested_for,plan_kind,mobility_practice_run_id)
          values('${workout}','${id(1)}','${id(30)}','pending','Draft test','${addition.date}','${addition.planKind}',${addition.mobilityRunId ? `'${addition.mobilityRunId}'` : "null"})`,
            id(1),
          );
          return { suggestedWorkoutId: workout };
        };
        const archive = async (workout: string) =>
          sql(
            `update public.suggested_workouts set status='archived' where id='${workout}'`,
            id(1),
          );
        sql(
          `update public.coaching_preferences set weekly_minutes=301 where person_id='${id(1)}'`,
          id(1),
        );
        const staleBaseline = snapshot();
        await assert.rejects(
          saveReviewedWeeklyCoachDraft({
            reviewed,
            fresh: rebuild(),
            selected: edited,
            save,
            archive,
          }),
          /changed while this draft/,
        );
        assert.equal(calls, 0);
        assert.equal(snapshot(), staleBaseline);
        sql(
          `update public.coaching_preferences set weekly_minutes=300 where person_id='${id(1)}'`,
          id(1),
        );
        await assert.rejects(
          saveReviewedWeeklyCoachDraft({
            reviewed,
            fresh: rebuild(),
            selected: edited,
            archive,
            save: async (addition) => {
              if (calls === 1) throw new Error("Second save failed");
              return save(addition);
            },
          }),
          /Second save failed/,
        );
        assert.equal(
          sql(`select status from public.suggested_workouts where id='${id(110)}'`, id(1)),
          "archived",
        );
        assert.equal(
          sql(
            `select count(*) from public.suggested_workouts where title='Draft test' and status in ('pending','accepted')`,
            id(1),
          ),
          "0",
        );
        assert.deepEqual(
          await saveReviewedWeeklyCoachDraft({
            reviewed,
            fresh: rebuild(),
            selected: edited,
            save,
            archive,
          }),
          { count: 2 },
        );
        assert.equal(
          sql(`select suggested_for from public.suggested_workouts where id='${id(112)}'`, id(1)),
          "2026-10-14",
        );
      },
    );
    await t.test("removes all journey records and exactly restores the fixture baseline", () => {
      sql(`begin;
        delete from public.coaching_recommendation_decisions;
        delete from public.suggested_workout_sets;
        delete from public.suggested_workout_entries;
        delete from public.suggested_workouts;
        delete from public.sessions;
        delete from public.program_assignment_exercises;
        delete from public.program_assignments;
        delete from public.coaching_preferences;
        commit;`);
      assert.equal(snapshot(), baseline);
    });
  } finally {
    db.close();
    assert.equal(existsSync(db.root), false, "temporary database directory must be removed");
  }
});
