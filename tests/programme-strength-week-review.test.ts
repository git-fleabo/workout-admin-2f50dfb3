import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261005174634_add_strength_week_review_loop.sql",
    import.meta.url,
  ),
  "utf8",
);

test("strength week reviews are durable, person-scoped and read-only outside the RPC", () => {
  assert.match(migration, /create table public\.programme_strength_week_reviews/i);
  assert.match(
    migration,
    /alter table public\.programme_strength_week_reviews enable row level security/i,
  );
  assert.match(migration, /app_private\.person_is_accessible\(person_id\)/i);
  assert.match(
    migration,
    /grant select on public\.programme_strength_week_reviews to authenticated/i,
  );
  assert.doesNotMatch(
    migration,
    /grant[^;]*(?:insert|update|delete)[^;]*programme_strength_week_reviews/i,
  );
});

test("review application validates the exact upcoming workout range and applies adjustments atomically", () => {
  assert.match(migration, /create function public\.apply_programme_strength_week_review/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /p_start_workout_index <> v_current_workout_index/i);
  assert.match(migration, /v_workout_count <> p_end_workout_index - p_start_workout_index \+ 1/i);
  assert.match(migration, /manual_adjustment_percent = v_manual_adjustment/i);
  assert.match(migration, /insert into public\.programme_strength_week_reviews/i);
  assert.match(
    migration,
    /revoke all on function public\.apply_programme_strength_week_review[\s\S]*from anon/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.apply_programme_strength_week_review[\s\S]*to authenticated/i,
  );
});

const hardening = readFileSync(
  new URL(
    "../supabase/migrations/20261005174824_harden_strength_week_review_loop.sql",
    import.meta.url,
  ),
  "utf8",
);

test("the public review RPC runs with caller privileges and the self-reference is indexed", () => {
  assert.match(hardening, /security invoker/i);
  assert.match(hardening, /programme_strength_week_reviews_previous_idx/i);
  assert.match(hardening, /programme_strength_week_reviews_insertable/i);
  assert.match(hardening, /programme_strength_week_reviews_updatable/i);
});

const volumeReview = readFileSync(
  new URL(
    "../supabase/migrations/20261005182137_add_week_scoped_strength_volume.sql",
    import.meta.url,
  ),
  "utf8",
);

test("strength review volume is constrained and stored with the reviewed week", () => {
  assert.match(volumeReview, /security invoker/i);
  assert.match(volumeReview, /v_set_adjustment not in \(-1, 0\)/i);
  assert.match(volumeReview, /'set_adjustment', v_set_adjustment/i);
});
