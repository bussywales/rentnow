import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260316012950_property_requests_phase1.sql"
);

void test("property requests migration defines table, lifecycle checks, and RLS policies", () => {
  const source = fs.readFileSync(migrationPath, "utf8");

  assert.match(source, /create table if not exists public\.property_requests/i);
  assert.match(source, /property_requests_status_check check \(status in \('draft', 'open', 'matched', 'closed', 'expired', 'removed'\)\)/);
  assert.match(source, /property_requests_publish_state_check/);
  assert.match(source, /alter table public\.property_requests enable row level security/i);
  assert.match(source, /alter table public\.property_requests force row level security/i);
  assert.match(source, /create policy "property requests owner select"/);
  assert.match(source, /create policy "property requests owner insert tenant"/);
  assert.match(source, /create policy "property requests responder read open"/);
  assert.match(source, /create policy "property requests admin read"/);
  assert.match(source, /create policy "property requests admin write"/);
});

void test("property requests migration keeps seeker visibility owner-only by default", () => {
  const source = fs.readFileSync(migrationPath, "utf8");

  assert.match(source, /owner_user_id = auth\.uid\(\)/);
  assert.doesNotMatch(source, /tenant public browse/i);
  assert.match(source, /p\.role in \('landlord', 'agent'\)/);
});
