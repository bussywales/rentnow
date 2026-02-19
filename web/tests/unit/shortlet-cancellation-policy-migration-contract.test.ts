import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("shortlet cancellation policy migration adds constrained policy column", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260219153000_shortlet_cancellation_policy_phase1.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");
  const normalized = sql.replace(/\s+/g, " ").toLowerCase();

  assert.match(
    normalized,
    /add column if not exists cancellation_policy text not null default 'flexible_48h'/
  );
  assert.match(
    normalized,
    /check \( cancellation_policy in \('flexible_24h', 'flexible_48h', 'moderate_5d', 'strict'\) \)/
  );
});
