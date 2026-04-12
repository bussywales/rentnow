import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("profiles admin support notification migration adds boolean preference columns", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260412113000_admin_support_notification_preferences.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();

  assert.match(sql, /alter table public\.profiles/);
  assert.match(sql, /add column if not exists support_request_email_enabled boolean not null default false/);
  assert.match(sql, /add column if not exists support_escalation_email_enabled boolean not null default false/);
});
