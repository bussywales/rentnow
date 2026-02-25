import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("support rate-limit migration creates support_rate_limit_events table", () => {
  const sqlPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260224135500_support_rate_limit_events.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");

  assert.match(sql, /create table if not exists public\.support_rate_limit_events/i);
  assert.match(sql, /route_key text not null/i);
  assert.match(sql, /scope_key text not null/i);
  assert.match(sql, /is_authenticated boolean not null default false/i);
  assert.match(sql, /alter table public\.support_rate_limit_events enable row level security/i);
});
