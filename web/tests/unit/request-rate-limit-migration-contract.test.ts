import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("request rate limit migration creates shared db-backed limiter table", () => {
  const filePath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260408110000_request_rate_limit_events.sql"
  );
  const sql = fs.readFileSync(filePath, "utf8");

  assert.match(sql, /create table if not exists public\.request_rate_limit_events/i);
  assert.match(sql, /route_key text not null/i);
  assert.match(sql, /scope_key text not null/i);
  assert.match(sql, /created_at timestamptz not null default now\(\)/i);
  assert.match(sql, /enable row level security/i);
});
