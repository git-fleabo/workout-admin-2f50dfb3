import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it, vi } from "vitest";
import { temporaryPostgres, pgSkip, json, literal } from "../helpers/temporary-postgres";
import { PROFILE_BACKUP_TABLES, readProfileBackup } from "@/lib/profile-backup";
import { personalPlanSchema } from "@/lib/personal-programme";
import { kettlebellPrescriptionSchema } from "@/lib/kettlebell-workouts";
const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  personId: "00000000-0000-4000-8000-000000000001",
}));
vi.mock("@/lib/supabase-public", () => ({ supabasePublicSelect: mocks.select }));
vi.mock("@/lib/supabase-people.browser", () => ({
  getCurrentPerson: async () => ({ id: mocks.personId }),
}));
import { getPersonalDataExport } from "@/lib/supabase-export.browser";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ident = (name: string) => {
  if (!/^[a-z_]+$/.test(name)) throw new Error("Unexpected identifier");
  return `"${name}"`;
};

it.skipIf(Boolean(pgSkip))(
  "exports and reconstructs the profile against the actual 56-table column/constraint snapshot",
  async () => {
    const source = temporaryPostgres(),
      restored = temporaryPostgres();
    try {
      for (const db of [source, restored]) {
        db.file(pathToFileURL(resolve("tests/fixtures/profile-backup-check-functions.sql")));
        db.file(pathToFileURL(resolve("tests/fixtures/profile-backup-database.sql")));
        db.file(pathToFileURL(resolve("tests/fixtures/profile-backup-unique-indexes.sql")));
        // The snapshot predates this repair; also enforce the newly installed owner FK.
        db.sql(
          readFileSync(
            resolve("supabase/migrations/20261011210526_enforce_strength_review_owner.sql"),
            "utf8",
          ).split("alter policy")[0],
        );
      }
      const generated = new Map<string, string[]>();
      const generatedColumns = (table: string) => {
        if (!generated.has(table))
          generated.set(
            table,
            JSON.parse(
              source.sql(
                `select coalesce(jsonb_agg(column_name),'[]') from information_schema.columns where table_schema='public' and table_name=${literal(table)} and is_generated='ALWAYS'`,
              ),
            ),
          );
        return generated.get(table)!;
      };
      const seeds: Array<{ table: string; row: Record<string, unknown> }> = [];
      const add = (table: string, row: Record<string, unknown>) => {
        seeds.push({ table, row });
      };
      // An explicit column insert uses table defaults for all omitted fields.
      add("people", {
        id: id(1),
        display_name: "Backup owner",
        auth_user_id: id(901),
        email: "owner@example.test",
      });
      add("people", {
        id: id(2),
        display_name: "Other private profile",
        email: "other-private@example.test",
      });
      add("people", {
        id: id(3),
        display_name: "Template author",
        email: "author-private@example.test",
      });
      add("app_profiles", {
        id: id(10),
        name: "Training",
        slug: "training",
        config: { tracking: "all" },
      });
      add("person_app_profiles", {
        id: id(11),
        person_id: id(1),
        app_profile_id: id(10),
        is_default: true,
      });
      add("activity_types", { id: id(20), name: "Strength", slug: "strength" });
      add("activity_types", { id: id(22), name: "Mobility", slug: "mobility" });
      add("exercises", {
        id: id(30),
        name: "Bench press",
        activity_type_id: id(20),
        default_metric: "Weight + reps",
      });
      add("exercises", {
        id: id(31),
        name: "Lat stretch",
        activity_type_id: id(22),
        default_metric: "Time",
      });
      add("exercises", {
        id: id(32),
        name: "Overhead press",
        activity_type_id: id(20),
        is_active: false,
      });
      add("exercise_aliases", {
        id: id(40),
        alias_name: "Old press",
        normalized_alias: "old press",
        exercise_id: id(32),
        activity_type_id: id(20),
        status: "reviewed",
        reviewed_by: id(3),
      });
      add("exercise_activity_types", { id: id(41), exercise_id: id(30), activity_type_id: id(22) });
      add("exercise_tags", { id: id(45), name: "Push", slug: "push" });
      add("exercise_tag_links", { exercise_id: id(30), tag_id: id(45) });
      add("person_exercises", {
        id: id(50),
        person_id: id(1),
        exercise_id: id(30),
        is_enabled: true,
      });
      add("person_exercises", {
        id: id(500),
        person_id: id(2),
        exercise_id: id(30),
        notes: "Do not export",
      });
      add("person_exercises", {
        id: id(501),
        person_id: id(1),
        exercise_id: id(31),
        is_enabled: true,
      });
      const lesson =
        "https://www.matthewismith.com/products/mobility-flexibility-toolkit/categories/1/posts/2";
      add("person_exercise_toolkit_lessons", {
        person_id: id(1),
        exercise_id: id(31),
        skill: "shoulder",
        lesson_url: lesson,
      });
      add("training_locations", { id: id(51), person_id: id(1), name: "Gym", kind: "gym" });
      add("equipment_items", {
        id: id(52),
        person_id: id(1),
        name: "Barbell",
        category: "free_weights",
        circuit_group: "barbell",
      });
      add("training_location_equipment", { location_id: id(51), equipment_item_id: id(52) });
      add("exercise_equipment_items", { exercise_id: id(30), equipment_item_id: id(52) });
      add("bodyweight_logs", {
        id: id(53),
        person_id: id(1),
        logged_date: "2026-10-05",
        bodyweight: 70.2,
      });
      add("one_rm_tests", {
        id: id(54),
        person_id: id(1),
        test_date: "2026-10-05",
        exercise_id: id(30),
        exercise_name: "Bench press",
        reps: 5,
        external_weight: 75,
      });
      add("goals", {
        id: id(55),
        person_id: id(1),
        goal: "Press target",
        exercise_id: id(30),
        status: "active",
      });
      add("goal_checkins", {
        id: id(56),
        person_id: id(1),
        goal_id: id(55),
        checked_date: "2026-10-05",
        note: "On track",
      });
      add("daily_rotation_items", {
        id: id(57),
        person_id: id(1),
        name: "Practice",
        target: "Easy",
      });
      add("daily_rotation_assignments", {
        id: id(58),
        person_id: id(1),
        item_id: id(57),
        assigned_date: "2026-10-05",
      });
      add("data_quality_batches", {
        id: id(59),
        person_id: id(1),
        batch_kind: "review",
        created_by: id(3),
      });
      add("data_quality_audit_events", {
        batch_id: id(59),
        person_id: id(1),
        entity_table: "entry_sets",
        entity_id: id(130),
        action: "update",
        reason: "Test correction",
        before_value: { reps: 4 },
        after_value: { reps: 5 },
      });
      add("programs", {
        id: id(60),
        name: "Shared template",
        created_by_person_id: id(3),
        is_template: true,
      });
      add("program_workouts", { id: id(61), program_id: id(60), name: "Day A", sequence_index: 0 });
      add("program_workout_entries", {
        id: id(62),
        program_workout_id: id(61),
        exercise_id: id(30),
        name: "Bench press",
        sets: "3",
        reps: "6",
        weight: "70",
      });
      add("program_assignments", {
        id: id(63),
        program_id: id(60),
        person_id: id(1),
        assigned_by_person_id: id(3),
        status: "active",
        current_workout_index: 0,
      });
      add("program_assignment_exercises", {
        id: id(64),
        program_assignment_id: id(63),
        slot_key: "bench",
        exercise_id: id(30),
        exercise_name: "Bench press",
        one_rm_test_id: id(54),
        training_max: 80,
      });
      add("program_assignment_exercise_pools", {
        id: id(65),
        program_assignment_id: id(63),
        role: "accessory",
        exercise_id: id(32),
        exercise_name: "Overhead press",
      });
      const movement = {
        exerciseId: id(32),
        programmeKey: "press:0",
        exercise: "Overhead press",
        workoutType: "Strength",
        trackingMode: "weight_reps",
        sourceDate: "",
        reason: "Saved targets",
        restTime: "2 min",
        targets: {
          durationMinutes: "",
          distance: "",
          distanceUnit: "",
          rounds: "",
          height: "",
          detail: "",
        },
        progression: { type: "double", minReps: 6, maxReps: 8, incrementKg: 2.5, maxRpe: 8 },
        setRows: [{ weight: "40", reps: "6", durationSeconds: "", rpe: "", completed: true }],
      };
      const plan = personalPlanSchema.parse({
        version: 1,
        locationKind: "gym",
        movements: [movement],
      });
      add("personal_programmes", { assignment_id: id(63), name: "My exact copy" });
      add("personal_programme_sessions", {
        assignment_id: id(63),
        program_workout_id: id(61),
        name: "My Day A",
        scheduled_on: "2026-10-05",
        plan,
        revision: 4,
      });
      add("programme_strength_week_reviews", {
        id: id(66),
        person_id: id(1),
        program_assignment_id: id(63),
        programme_week: 1,
        start_workout_index: 0,
        end_workout_index: 0,
        workout_ids: [id(61)],
        recovery_level: "lighter",
        recommendation_kind: "reduce",
        applied_adjustments: [
          { exercise_id: id(32), saved_plan: plan, revision: 4, load_adjustment_percent: -2.5 },
        ],
      });
      add("training_methods", {
        id: id(70),
        person_id: null,
        name: "Set method",
        family: "set_method",
        system_key: "drop_set",
      });
      add("training_methods", {
        id: id(71),
        person_id: null,
        name: "Superset",
        family: "exercise_group",
        system_key: "superset",
      });
      add("training_methods", {
        id: id(72),
        person_id: id(1),
        name: "My timed method",
        family: "timed_density",
        is_active: false,
      });
      add("person_training_methods", {
        person_id: id(1),
        training_method_id: id(70),
        is_enabled: true,
        default_config: { rest: 20 },
      });
      add("mobility_practice_runs", {
        id: id(80),
        person_id: id(1),
        skill: "shoulder",
        started_on: "2026-10-05",
      });
      add("mobility_practice_drills", {
        id: id(81),
        run_id: id(80),
        exercise_id: id(31),
        name: "Lat stretch",
        lesson_url: lesson,
        target_sets: 2,
        target_hold_seconds: 20,
      });
      add("mobility_assessment_results", {
        id: id(82),
        run_id: id(80),
        test_key: "position",
        side: "left",
        measured_on: "2026-10-05",
        value_numeric: 30,
        unit: "deg",
        setup_note: "Consistent setup",
      });
      const kbMovement = Object.fromEntries(
        Object.entries(movement).filter(([key]) => key !== "programmeKey" && key !== "progression"),
      );
      const prescription = kettlebellPrescriptionSchema.parse({
        movements: [kbMovement],
        methodBlocks: [],
      });
      add("kettlebell_workouts", {
        id: id(90),
        person_id: id(1),
        category: "strength",
        source_number: 1,
        title: "Saved picker workout",
        instructions: "Use saved targets",
        bell_count: 1,
        duration_minutes: 10,
        prescription,
        required_equipment_ids: [id(52)],
      });
      add("sessions", {
        id: id(100),
        person_id: id(1),
        activity_type_id: id(20),
        session_date: "2026-10-05",
        title: "Completed",
        training_location_id: id(51),
        mobility_practice_run_id: id(80),
      });
      add("sessions", {
        id: id(101),
        person_id: id(2),
        activity_type_id: id(20),
        session_date: "2026-10-05",
        title: "Other private session",
      });
      add("program_workout_reviews", {
        id: id(102),
        program_assignment_id: id(63),
        program_workout_id: id(61),
        program_assignment_exercise_id: id(64),
        session_id: id(100),
        decision: "repeat",
        rpe: 8,
      });
      add("suggested_workouts", {
        id: id(110),
        person_id: id(1),
        program_assignment_id: id(63),
        program_workout_id: id(61),
        status: "completed",
        title: "Planned strength",
        suggested_for: "2026-10-05",
        completed_session_id: id(100),
        training_location_id: id(51),
      });
      add("suggested_workouts", {
        id: id(111),
        person_id: id(1),
        program_assignment_id: id(63),
        status: "accepted",
        title: "Support",
        suggested_for: "2026-10-06",
        mobility_practice_run_id: id(80),
        goal_id: id(55),
      });
      add("suggested_workouts", {
        id: id(112),
        person_id: id(1),
        status: "accepted",
        title: "Standalone kettlebell",
        kettlebell_request_id: id(903),
        plan_kind: "strength",
        suggested_for: "2026-10-07",
        training_location_id: id(51),
        kettlebell_workout_id: id(90),
        kettlebell_snapshot: {
          id: id(90),
          title: "Saved picker workout",
          category: "strength",
          version: 1,
          prescription,
        },
      });
      add("session_entries", {
        id: id(120),
        session_id: id(100),
        exercise_id: id(30),
        activity_type_id: id(20),
        name: "Bench press",
      });
      add("entry_sets", {
        id: id(130),
        session_entry_id: id(120),
        set_number: 1,
        reps: 6,
        weight: 70,
        load_semantics: "total_external_load",
        volume_status: "exact",
      });
      add("entry_metrics", {
        id: id(140),
        session_entry_id: id(120),
        metric_key: "feel",
        metric_text: "Good",
      });
      add("entry_set_segments", {
        id: id(150),
        entry_set_id: id(130),
        training_method_id: id(70),
        method_name: "Drop set",
        segment_index: 0,
        reps: 3,
        weight: 60,
      });
      add("session_method_blocks", {
        id: id(160),
        session_id: id(100),
        training_method_id: id(71),
        method_name: "Superset",
        family: "exercise_group",
        config: { rest: 60 },
      });
      add("session_method_block_entries", {
        block_id: id(160),
        session_entry_id: id(120),
        sequence_index: 0,
      });
      add("suggested_workout_entries", {
        id: id(170),
        suggested_workout_id: id(110),
        exercise_id: id(32),
        name: "Overhead press",
        workout_type: "Strength",
        tracking_mode: "weight_reps",
        target_metrics: { exerciseId: id(32) },
      });
      add("suggested_workout_sets", {
        id: id(180),
        suggested_workout_entry_id: id(170),
        set_number: 1,
        reps: 6,
        weight: 40,
      });
      add("suggested_workout_set_segments", {
        id: id(190),
        suggested_workout_set_id: id(180),
        training_method_id: id(70),
        method_name: "Drop set",
        segment_index: 0,
        reps: 3,
        weight: 30,
      });
      add("suggested_workout_method_blocks", {
        id: id(195),
        suggested_workout_id: id(110),
        training_method_id: id(71),
        method_name: "Superset",
        family: "exercise_group",
      });
      add("suggested_workout_method_block_entries", {
        block_id: id(195),
        suggested_workout_entry_id: id(170),
        sequence_index: 0,
      });
      add("coaching_preferences", {
        person_id: id(1),
        primary_focus_id: "strength",
        secondary_focus_ids: ["mobility"],
        maintenance_focus_ids: ["climbing"],
        weekly_training_days: 4,
        weekly_minutes: 240,
        max_demanding_days: 2,
      });
      add("coaching_recommendation_decisions", {
        id: id(200),
        person_id: id(1),
        week_start: "2026-10-05",
        recommendation_key: "move:1",
        subject_focus_id: "mobility",
        recommendation_type: "move_session",
        suggested_workout_id: id(111),
        original_date: "2026-10-06",
        proposed_date: "2026-10-07",
        chosen_date: "2026-10-07",
        decision: "accepted",
        rationale: "User choice",
      });
      add("coaching_recommendation_outcomes", {
        id: id(201),
        decision_id: id(200),
        outcome_rating: "right",
      });

      const required = JSON.parse(
        source.sql(
          `select jsonb_agg(jsonb_build_object('table',table_name,'column',column_name)) from information_schema.columns where table_schema='public' and is_nullable='NO' and column_default is null and is_identity='NO' and is_generated='NEVER'`,
        ),
      ) as { table: string; column: string }[];
      const missing = seeds.flatMap(({ table, row }) =>
        required
          .filter((field) => field.table === table && !(field.column in row))
          .map((field) => `${table}.${field.column}`),
      );
      expect(missing, "Fixture must satisfy real required columns").toEqual([]);
      for (const { table, row } of seeds) {
        const columns = Object.keys(row).filter(
          (column) => !generatedColumns(table).includes(column),
        );
        source.sql(
          `insert into public.${ident(table)}(${columns.map(ident).join(",")}) select ${columns.map(ident).join(",")} from jsonb_populate_record(null::public.${ident(table)},${json(row)})`,
        );
      }

      mocks.select.mockImplementation(
        async (table: string, params: Record<string, string | number>) => {
          expect(PROFILE_BACKUP_TABLES).toContain(table);
          const where: string[] = [];
          for (const [column, value] of Object.entries(params)) {
            if (typeof value !== "string") continue;
            if (value.startsWith("eq.")) where.push(`${ident(column)}=${literal(value.slice(3))}`);
            if (value.startsWith("in.("))
              where.push(
                `${ident(column)} in (${value.slice(4, -1).split(",").map(literal).join(",")})`,
              );
          }
          const order = String(params.order)
            .split(",")
            .map((value) => ident(value.split(".")[0]))
            .join(",");
          // Simulate a server cap below the requested page size.
          return JSON.parse(
            source.sql(
              `select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select * from public.${ident(table)} ${where.length ? `where ${where.join(" and ")}` : ""} order by ${order} limit 2 offset ${Number(params.offset)}) t`,
            ),
          );
        },
      );
      const backup = readProfileBackup(JSON.stringify(await getPersonalDataExport()));
      expect(backup.schema_version).toBe(1);
      expect(backup.backup_manifest.external_people_ids).toEqual([id(3)]);
      expect(backup.people.map((row) => row.id)).toEqual([id(1)]);
      expect(backup.sessions.map((row) => row.id)).toEqual([id(100)]);
      expect(JSON.stringify(backup)).not.toContain("other-private@example.test");
      expect(JSON.stringify(backup)).not.toContain("author-private@example.test");
      expect(backup.personal_programme_sessions[0]).toMatchObject({ revision: 4, plan });
      expect(backup.exercises.find((row) => row.id === id(32))).toMatchObject({ is_active: false });
      expect(backup.training_methods.map((row) => row.id).sort()).toEqual([id(70), id(71), id(72)]);
      const actualTables = JSON.parse(
        source.sql(
          "select jsonb_agg(table_name order by table_name) from information_schema.tables where table_schema='public'",
        ),
      );
      expect([...PROFILE_BACKUP_TABLES].sort()).toEqual(
        actualTables.filter((name: string) => name !== "admin_people"),
      );
      expect(PROFILE_BACKUP_TABLES.every((table) => backup[table].length > 0)).toBe(true);
      // Restoration is isolated, never a live import. Defer FKs to restore cycles
      // and earlier-review links, then validate every real FK on commit.
      restored.sql(
        `do $$ declare item record; begin for item in select c.relname,con.conname from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and con.contype='f' loop execute format('alter table public.%I alter constraint %I deferrable initially deferred',item.relname,item.conname); end loop; end $$;`,
      );
      restored.sql(`begin; insert into public.people(id,display_name,status) values('${id(3)}','External author reference','inactive');
      ${PROFILE_BACKUP_TABLES.map((table) =>
        (() => {
          const columns = JSON.parse(
            source.sql(
              `select jsonb_agg(column_name order by ordinal_position) from information_schema.columns where table_schema='public' and table_name=${literal(table)} and is_generated='NEVER'`,
            ),
          ) as string[];
          return `insert into public.${ident(table)}(${columns.map(ident).join(",")}) select ${columns.map(ident).join(",")} from jsonb_populate_recordset(null::public.${ident(table)},${json(backup[table])});`;
        })(),
      ).join("\n")}
      set constraints all immediate; commit;`);
      const sequences = JSON.parse(
        restored.sql(
          `select jsonb_agg(jsonb_build_object('table',table_name,'column',column_name)) from information_schema.columns where table_schema='public' and (is_identity='YES' or column_default like 'nextval(%')`,
        ),
      ) as { table: string; column: string }[];
      for (const sequence of sequences) {
        restored.sql(
          `select setval(pg_get_serial_sequence(${literal(`public.${sequence.table}`)},${literal(sequence.column)}),greatest(coalesce(max(${ident(sequence.column)}),1),1),count(*)>0) from public.${ident(sequence.table)}`,
        );
      }
      for (const table of PROFILE_BACKUP_TABLES) {
        const rows = JSON.parse(
          restored.sql(
            `select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.${ident(table)} t ${table === "people" ? `where id='${id(1)}'` : ""}`,
          ),
        );
        const normalize = (records: unknown[]) => records.map((row) => JSON.stringify(row)).sort();
        expect(normalize(rows), table).toEqual(normalize(backup[table]));
      }
      const previousMax = Number(
        restored.sql("select max(id) from public.data_quality_audit_events"),
      );
      const nextId = Number(
        restored.sql(
          `insert into public.data_quality_audit_events(batch_id,person_id,entity_table,entity_id,action,reason) values('${id(59)}','${id(1)}','entry_sets','${id(130)}','update','After restore') returning id`,
        ),
      );
      expect(nextId).toBeGreaterThan(previousMax);
    } finally {
      source.close();
      restored.close();
      mocks.select.mockReset();
    }
  },
  30000,
);
