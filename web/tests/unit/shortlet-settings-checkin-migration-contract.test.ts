import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("shortlet settings check-in migration adds host guidance fields", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260222190000_shortlet_checkin_house_rules.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();

  assert.match(sql, /add column if not exists checkin_instructions text/);
  assert.match(sql, /add column if not exists checkin_window_start time/);
  assert.match(sql, /add column if not exists checkin_window_end time/);
  assert.match(sql, /add column if not exists access_method text/);
  assert.match(sql, /add column if not exists access_code_hint text/);
  assert.match(sql, /add column if not exists house_rules text/);
  assert.match(sql, /add column if not exists pets_allowed boolean/);
  assert.match(sql, /add column if not exists smoking_allowed boolean/);
  assert.match(sql, /add column if not exists parties_allowed boolean/);
  assert.match(sql, /add column if not exists emergency_notes text/);
  assert.match(sql, /max_guests_override is null or max_guests_override >= 1/);
});
