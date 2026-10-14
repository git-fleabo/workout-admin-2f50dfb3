import test from "node:test";
import assert from "node:assert/strict";
import { pgSkip, temporaryPostgres, json } from "./helpers/temporary-postgres.ts";
import { coachDatabaseMigrations } from "./helpers/coach-database-migrations.ts";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const migration = "20261014202016_programme_schedule_shifts.sql";

test(
  "atomic date-only programme changes, access, stale previews, clashes and Undo",
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
      insert into public.exercises values('${id(10)}');
      insert into public.programs(id,is_template,method_type) values('${id(11)}',true,'jacked_dumbbell');
      insert into public.program_workouts(id,program_id,sequence_index,week_number,day_number) values
        ('${id(20)}','${id(11)}',1,1,1),('${id(21)}','${id(11)}',3,1,3),
        ('${id(22)}','${id(11)}',7,1,5),('${id(23)}','${id(11)}',10,2,1);
      insert into public.training_locations values('${id(30)}','${id(1)}','gym',true),('${id(31)}','${id(2)}','gym',true);`);
      for (const name of [
        ...coachDatabaseMigrations,
        "20261010115211_add_personal_strength_week_reviews.sql",
        migration,
      ])
        db.file(new URL(`../supabase/migrations/${name}`, import.meta.url));
      sql(`insert into public.program_assignments(id,program_id,person_id,status,current_workout_index,started_on)
      values('${id(40)}','${id(11)}','${id(1)}','active',1,'2026-10-05');
      insert into public.sessions values('${id(90)}','${id(1)}',true);
      insert into public.suggested_workouts(id,person_id,program_assignment_id,program_workout_id,status,suggested_for,completed_session_id)
      values('${id(91)}','${id(1)}','${id(40)}','${id(20)}','completed','2026-10-05','${id(90)}');
      insert into public.suggested_workouts(id,person_id,program_assignment_id,program_workout_id,status,suggested_for)
      values('${id(92)}','${id(1)}','${id(40)}','${id(21)}','pending','2026-10-07');
      insert into public.suggested_workouts(id,person_id,status,suggested_for,title)
      values('${id(50)}','${id(1)}','pending','2026-10-14','Yoga');`);
      const originalAssignment = sql(
        `select to_jsonb(a) from public.program_assignments a where id='${id(40)}'`,
      );
      const completed = sql(
        `select to_jsonb(s) from public.suggested_workouts s where id='${id(91)}'`,
      );
      const snapshot = (assignment = id(40)) =>
        JSON.parse(
          sql(`select jsonb_agg(jsonb_build_object(
      'workoutId',w.id,'date',app_private.programme_session_scheduled_date(a.id,w.id),
      'scheduleRevision',coalesce(d.revision,0),'personalRevision',p.revision,
      'locked',exists(select 1 from public.suggested_workouts s where s.program_assignment_id=a.id and s.program_workout_id=w.id and s.status in ('accepted','completed','skipped')))
      order by w.sequence_index,w.id)
      from public.program_assignments a join public.program_workouts w on w.program_id=a.program_id
      left join public.programme_session_dates d on d.assignment_id=a.id and d.program_workout_id=w.id
      left join public.personal_programme_sessions p on p.assignment_id=a.id and p.program_workout_id=w.id
      where a.id='${assignment}' and app_private.programme_workout_position(w.id)>=a.current_workout_index`),
        );
      const first = snapshot();
      const expectedClash = [{ id: id(50), date: "2026-10-14", workoutId: id(21) }];
      const apply = (
        items = first,
        newDate = "2026-10-14",
        clashes: unknown[] = expectedClash,
        person = id(1),
        undo = false,
      ) =>
        sql(
          `select public.reschedule_programme_sessions('${id(40)}',1,'${id(21)}','${newDate}',${json(items)},${json(clashes)},${undo})`,
          person,
        );
      const dateState = () =>
        sql(
          "select coalesce(jsonb_agg(to_jsonb(d) order by assignment_id,program_workout_id),'[]') from public.programme_session_dates d",
        );

      await t.test(
        "rejects wrong person, anonymous access, partial batches and unseen clashes without writes",
        () => {
          const baseline = dateState();
          assert.throws(
            () => apply(first, "2026-10-14", expectedClash, id(2)),
            /Programme not found/,
          );
          assert.throws(
            () =>
              sql(
                `select public.reschedule_programme_sessions('${id(40)}',1,'${id(21)}','2026-10-14',${json(first)})`,
                id(1),
                "anon",
              ),
            /permission denied/,
          );
          assert.throws(() => apply(first.slice(1)), /remaining sessions changed/);
          assert.throws(() => apply(first, "2026-10-14", []), /Other planned training changed/);
          assert.equal(dateState(), baseline);
        },
      );
      await t.test(
        "rolls back earlier date and pending-plan updates if a later write fails",
        () => {
          sql(`create function public.fail_later_date() returns trigger language plpgsql as $$ begin
            if new.program_workout_id='${id(22)}' then raise exception 'Injected later write failure'; end if;
            return new; end $$;
            create trigger fail_later_date before insert on public.programme_session_dates for each row execute function public.fail_later_date();`);
          const baseline = dateState();
          assert.throws(() => apply(), /Injected later write failure/);
          assert.equal(dateState(), baseline);
          assert.equal(
            sql(`select suggested_for from public.suggested_workouts where id='${id(92)}'`),
            "2026-10-07",
          );
          sql(
            "drop trigger fail_later_date on public.programme_session_dates; drop function public.fail_later_date();",
          );
        },
      );
      await t.test(
        "shifts all unstarted dates together and updates pending links while leaving source/history intact",
        () => {
          assert.equal(apply(), "3");
          assert.deepEqual(
            snapshot().map((item: { date: string }) => item.date),
            ["2026-10-14", "2026-10-16", "2026-10-19"],
          );
          assert.equal(
            sql(`select suggested_for from public.suggested_workouts where id='${id(92)}'`),
            "2026-10-14",
          );
          assert.equal(
            sql(`select to_jsonb(a) from public.program_assignments a where id='${id(40)}'`),
            originalAssignment,
          );
          assert.equal(
            sql(`select to_jsonb(s) from public.suggested_workouts s where id='${id(91)}'`),
            completed,
          );
          const baseline = dateState();
          assert.throws(() => apply(), /session changed or started/);
          assert.equal(dateState(), baseline);
          assert.equal(sql("select count(*) from public.programme_session_dates", id(2)), "0");
          assert.throws(
            () =>
              sql(
                `insert into public.programme_session_dates values('${id(40)}','${id(20)}','2026-10-14',1)`,
                id(1),
              ),
            /remaining sessions/,
          );
        },
      );
      await t.test(
        "restores previous dates only against the newly written revisions and rejects a newly started session",
        () => {
          assert.equal(apply(snapshot(), "2026-10-07", [], id(1), true), "3");
          assert.deepEqual(
            snapshot().map((item: { date: string }) => item.date),
            first.map((item: { date: string }) => item.date),
          );
          assert.equal(apply(snapshot()), "3");
          const undo = snapshot();
          sql(`update public.suggested_workouts set status='accepted' where id='${id(92)}'`, id(1));
          const baseline = dateState();
          assert.throws(
            () => apply(undo, "2026-10-07", [], id(1), true),
            /session changed or started/,
          );
          assert.equal(dateState(), baseline);
        },
      );

      await t.test(
        "personal prescriptions, revisions and approved strength targets survive a date shift and start",
        () => {
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
                reason: "Saved",
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
                setRows: Array.from({ length: 3 }, () => ({
                  weight: "20",
                  reps: "8",
                  durationSeconds: "",
                  rpe: "8",
                  completed: true,
                })),
              },
            ],
          };
          const personalSessions = [5, 7, 9, 12].map((day, i) => ({
            workoutId: id(20 + i),
            name: `Personal ${i + 1}`,
            scheduledDate: `2026-10-${String(day).padStart(2, "0")}`,
            plan,
          }));
          const assignment = sql(
            `select public.create_personal_programme('${id(2)}','${id(11)}','Personal','2026-10-05',${json(personalSessions)})`,
            id(2),
          );
          sql(
            `update public.program_assignments set status='active' where id='${assignment}'`,
            id(2),
          );
          const review = sql(
            `select public.apply_personal_strength_week_review('${assignment}',0,${json([0, 1, 2].map((i) => ({ workout_id: id(20 + i), revision: 1 })))},'deload','reduce',${json([{ programme_key: "press:0", exercise_id: id(10), load_adjustment_percent: -5, set_adjustment: -1 }])},null)`,
            id(2),
          );
          const baseline = sql(
            `select jsonb_agg(to_jsonb(p) order by program_workout_id) from public.personal_programme_sessions p where assignment_id='${assignment}'`,
          );
          const reviewBefore = sql(
            `select to_jsonb(r) from public.programme_strength_week_reviews r where id='${review}'`,
          );
          assert.equal(
            sql(
              `select public.reschedule_programme_sessions('${assignment}',0,'${id(20)}','2026-10-14',${json(snapshot(assignment))},'[]')`,
              id(2),
            ),
            "4",
          );
          assert.equal(
            sql(
              `select jsonb_agg(to_jsonb(p) order by program_workout_id) from public.personal_programme_sessions p where assignment_id='${assignment}'`,
            ),
            baseline,
          );
          assert.equal(
            sql(
              `select to_jsonb(r) from public.programme_strength_week_reviews r where id='${review}'`,
            ),
            reviewBefore,
          );
          const started = sql(
            `select public.start_personal_programme_session('${assignment}','${id(20)}',1,'${id(31)}',false,'${review}')`,
            id(2),
          );
          assert.equal(
            sql(
              `select count(*) from public.suggested_workout_sets s join public.suggested_workout_entries e on e.id=s.suggested_workout_entry_id where e.suggested_workout_id='${started}'`,
            ),
            "2",
          );
          assert.equal(
            sql(
              `select distinct s.weight from public.suggested_workout_sets s join public.suggested_workout_entries e on e.id=s.suggested_workout_entry_id where e.suggested_workout_id='${started}'`,
            ),
            "19",
          );
        },
      );
    } finally {
      db.close();
    }
  },
);
