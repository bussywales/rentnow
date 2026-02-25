import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("fx daily rates migration creates table and key constraints", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260225170000_fx_daily_rates.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();

  assert.match(sql, /create table if not exists public\.fx_daily_rates/);
  assert.match(sql, /date date primary key/);
  assert.match(sql, /base_currency text not null check \(base_currency ~ '\^\[a-z\]\{3\}\$'\)/);
  assert.match(sql, /rates jsonb not null default '\{\}'::jsonb/);
  assert.match(sql, /alter table public\.fx_daily_rates enable row level security/);
  assert.match(sql, /create policy "fx daily rates service write"/);
});
