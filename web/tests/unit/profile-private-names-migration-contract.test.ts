import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("profiles private names migration adds nullable first_name and last_name columns", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260224160000_profiles_private_names.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8").replace(/\s+/g, " ").toLowerCase();

  assert.match(sql, /alter table public\.profiles/);
  assert.match(sql, /add column if not exists first_name text null/);
  assert.match(sql, /add column if not exists last_name text null/);
});
