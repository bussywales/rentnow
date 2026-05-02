import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("delivery monitor migration creates only the minimal admin-only overlay tables", () => {
  const sql = fs
    .readFileSync(
      path.join(process.cwd(), "supabase", "migrations", "20260502140000_delivery_monitor_mvp.sql"),
      "utf8"
    )
    .replace(/\s+/g, " ")
    .toLowerCase();

  assert.match(sql, /create table if not exists public\.delivery_monitor_state_overrides/);
  assert.match(sql, /create table if not exists public\.delivery_monitor_test_runs/);
  assert.match(sql, /create table if not exists public\.delivery_monitor_notes/);
  assert.match(sql, /status in \('green', 'amber', 'red'\)/);
  assert.match(sql, /testing_status in \('not_started', 'in_progress', 'passed', 'failed'\)/);
  assert.match(sql, /public\.is_admin\(\)/);
  assert.doesNotMatch(sql, /assignments?/);
  assert.doesNotMatch(sql, /attachments?/);
  assert.doesNotMatch(sql, /story points?/);
});
