import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("shortlet respond-by migration enforces 12-hour request window", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260217220000_shortlet_respond_by_12h.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");
  const normalized = sql.replace(/\s+/g, " ").toLowerCase();

  assert.match(normalized, /add column if not exists respond_by timestamptz/);
  assert.match(normalized, /resolved_expiry := case when resolved_mode = 'request' then now_ts \+ interval '12 hours' else null end/);
  assert.match(normalized, /respond_by = case when next_status = 'pending' then coalesce\(respond_by, expires_at, created_at \+ interval '12 hours'\)/);
  assert.doesNotMatch(normalized, /interval '24 hours'/);
});
