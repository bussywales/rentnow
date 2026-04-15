import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("explore analytics anonymous ingest migration makes user_id nullable", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260415003000_explore_events_anonymous_ingest.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.match(contents, /ALTER TABLE public\.explore_events/);
  assert.match(contents, /ALTER COLUMN user_id DROP NOT NULL/);
});
