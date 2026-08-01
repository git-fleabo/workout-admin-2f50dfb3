import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260801081254_add_programme_manual_adjustments.sql",
    import.meta.url,
  ),
  "utf8",
);

test("manual programme adjustments are bounded and applied atomically", () => {
  assert.match(migration, /manual_adjustment_percent between -5 and 5/i);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /status in \('active', 'paused'\)/i);
  assert.match(migration, /adjustment_value not in \(-5, -2\.5, 0, 2\.5, 5\)/i);
  assert.match(migration, /get diagnostics affected_rows = row_count/i);
  assert.match(migration, /raise exception 'A programme exercise could not be updated\.'/i);
});

test("manual programme adjustment RPC is authenticated only", () => {
  assert.match(
    migration,
    /revoke all on function public\.apply_programme_manual_adjustments\(uuid, jsonb\) from public/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.apply_programme_manual_adjustments\(uuid, jsonb\) from anon/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.apply_programme_manual_adjustments\(uuid, jsonb\) to authenticated/i,
  );
});
