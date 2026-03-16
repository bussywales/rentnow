import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("profiles admin listing review email migration adds boolean preference column", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260316101500_admin_listing_review_email_preferences.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();

  assert.match(sql, /alter table public\.profiles/);
  assert.match(sql, /add column if not exists listing_review_email_enabled boolean not null default false/);
});
