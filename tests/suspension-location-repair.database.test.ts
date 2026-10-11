import test from "node:test";
import assert from "node:assert/strict";
import { temporaryPostgres, pgSkip } from "./helpers/temporary-postgres.ts";

test(
  "suspension scope repair is bounded to enabled equipped imports and is idempotent",
  { skip: pgSkip },
  () => {
    const db = temporaryPostgres();
    try {
      db.sql(`create table public.people(id int primary key, display_name text, status text);
      create table public.exercises(id int primary key, name text, is_active boolean);
      create table public.person_exercises(id int primary key, person_id int, exercise_id int, is_enabled boolean, location_scope text, updated_at timestamptz default '2026-07-01');
      create table public.equipment_items(id int primary key, person_id int, name text, is_active boolean);
      create table public.exercise_equipment_items(exercise_id int, equipment_item_id int);
      create table public.training_locations(id int primary key, person_id int, kind text, is_active boolean);
      create table public.training_location_equipment(location_id int, equipment_item_id int);
      insert into public.people values(1,'Noam','active'),(2,'Other','active');
      insert into public.equipment_items values(1,1,'Gymnastic rings',true),(2,1,'TRX',true),(3,1,'Barbell',true),(4,2,'Gymnastic rings',true);
      insert into public.training_locations values(1,1,'home',true),(2,1,'gym',true),(3,2,'home',true);
      insert into public.training_location_equipment values(1,1),(1,2),(2,1),(2,2),(2,3),(3,4);
      insert into public.exercises values(1,'Ring Dip',true),(2,'TRX Row',true),(3,'TRX Body Saw',true),(4,'Ring Disabled',true),(5,'Ring Archived',false),(6,'Bar Muscle-Up',true),(7,'TRX Barbell Combo',true),(8,'Ring Other Person',true),(9,'Ring Without Requirements',true);
      insert into public.person_exercises(id,person_id,exercise_id,is_enabled,location_scope) values(1,1,1,true,'gym'),(2,1,2,true,'gym'),(3,1,3,true,'home'),(4,1,4,false,'gym'),(5,1,5,true,'gym'),(6,1,6,true,'gym'),(7,1,7,true,'gym'),(8,2,8,true,'gym'),(9,1,9,true,'gym');
      insert into public.exercise_equipment_items values(1,1),(2,2),(3,2),(4,1),(5,1),(6,1),(7,2),(7,3),(8,4);`);
      const snapshot = () =>
        db.sql("select jsonb_agg(to_jsonb(pe) order by id) from public.person_exercises pe");
      const before = JSON.parse(snapshot());
      const migration = new URL(
        "../supabase/migrations/20261011140404_fix_suspension_exercise_location_scopes.sql",
        import.meta.url,
      );
      db.file(migration);
      const after = JSON.parse(snapshot());
      assert.equal(after[0].location_scope, "both");
      assert.equal(after[1].location_scope, "both");
      assert.deepEqual(after.slice(2), before.slice(2));
      const firstRun = snapshot();
      db.file(migration);
      assert.equal(snapshot(), firstRun);
    } finally {
      db.close();
    }
  },
);
