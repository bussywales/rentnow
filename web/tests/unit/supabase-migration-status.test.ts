import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import {
  collectLocalMigrationIds,
  findPendingLocalMigrations,
  parseSupabaseMigrationListOutput,
} from "@/lib/ops/supabase-migration-status";

test("collectLocalMigrationIds keeps numbered and timestamped migration ids in order", () => {
  const ids = collectLocalMigrationIds([
    "20260313120000_explore_v2_cta_copy_variant.sql",
    "002_core_schema.sql",
    "README.md",
    "001_profiles_id_alignment.sql",
  ]);

  assert.deepEqual(ids, ["001", "002", "20260313120000"]);
});

test("parseSupabaseMigrationListOutput reads local and remote ids from supabase table output", () => {
  const parsed = parseSupabaseMigrationListOutput(`
Connecting to remote database...

   Local          | Remote         | Time (UTC)
  ----------------|----------------|---------------------
   001            | 001            | 001
   20260311123000 | 20260311123000 | 2026-03-11 12:30:00
   20260313120000 |                | 2026-03-13 12:00:00
`);

  assert.deepEqual(parsed.localIds, ["001", "20260311123000", "20260313120000"]);
  assert.deepEqual(parsed.remoteIds, ["001", "20260311123000"]);
});

test("findPendingLocalMigrations returns local ids missing remotely", () => {
  const pending = findPendingLocalMigrations({
    localIds: ["001", "002", "20260313120000"],
    remoteIds: ["001", "002"],
  });

  assert.deepEqual(pending, ["20260313120000"]);
});

test("package and workflow wire the migration status guard", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")
  ) as {
    scripts?: Record<string, string>;
  };
  assert.equal(
    packageJson.scripts?.["db:migrations:status"],
    "tsx ./scripts/check-supabase-migration-status.ts"
  );

  const workflow = fs.readFileSync(
    path.resolve(process.cwd(), "..", ".github", "workflows", "supabase-migrations.yml"),
    "utf8"
  );
  assert.match(workflow, /npm run db:migrations:status/);
  assert.match(workflow, /SUPABASE_PROJECT_REF/);
  assert.match(workflow, /SUPABASE_DB_PASSWORD/);
});
