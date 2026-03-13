import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  collectLocalMigrationIds,
  findPendingLocalMigrations,
  findRemoteOnlyMigrations,
  parseSupabaseMigrationListOutput,
} from "@/lib/ops/supabase-migration-status";

const projectRoot = process.cwd();
const migrationsDir = path.resolve(projectRoot, "supabase", "migrations");
const supabaseProjectRef = process.env.SUPABASE_PROJECT_REF?.trim() ?? "";
const supabaseDbPassword = process.env.SUPABASE_DB_PASSWORD?.trim() ?? "";

function runSupabaseCli(args: string[]) {
  return spawnSync("npx", ["supabase@latest", ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
}

function fail(message: string, detail?: string): never {
  console.error(`[migrations] ${message}`);
  if (detail) {
    console.error(detail.trim());
  }
  process.exit(1);
}

if (!fs.existsSync(migrationsDir)) {
  fail(`Migration directory not found at ${migrationsDir}.`);
}

const localMigrationIds = collectLocalMigrationIds(fs.readdirSync(migrationsDir));
if (localMigrationIds.length === 0) {
  fail("No local migrations were found. Refusing to report a false green state.");
}

if (supabaseProjectRef && supabaseDbPassword) {
  const linkResult = runSupabaseCli([
    "link",
    "--project-ref",
    supabaseProjectRef,
    "--password",
    supabaseDbPassword,
  ]);

  if (linkResult.status !== 0) {
    fail(
      "Unable to link the configured Supabase project before checking migration drift.",
      [linkResult.stdout, linkResult.stderr]
        .filter(Boolean)
        .join("\n")
    );
  }
}

const migrationListResult = runSupabaseCli(["migration", "list"]);
if (migrationListResult.status !== 0) {
  fail(
    "Unable to verify remote migration status.",
    [
      migrationListResult.stdout,
      migrationListResult.stderr,
      "Next step: ensure the repo is linked to the right Supabase project, then rerun `npm --prefix web run db:migrations:status`.",
      "If you need to apply pending schema changes, run `cd web && npx supabase@latest db push --include-all`.",
    ]
      .filter(Boolean)
      .join("\n")
  );
}

const parsedTable = parseSupabaseMigrationListOutput(migrationListResult.stdout);
if (parsedTable.remoteIds.length === 0) {
  fail(
    "Remote migration history could not be parsed. Refusing to report a false green state.",
    [
      migrationListResult.stdout,
      "Next step: rerun `npm --prefix web run db:migrations:status` with a linked Supabase project.",
    ].join("\n")
  );
}

const pendingLocal = findPendingLocalMigrations({
  localIds: localMigrationIds,
  remoteIds: parsedTable.remoteIds,
});

if (pendingLocal.length > 0) {
  fail(
    `Remote project is behind local repo by ${pendingLocal.length} migration(s).`,
    [
      "Pending local migrations:",
      ...pendingLocal.map((migrationId) => `- ${migrationId}`),
      "",
      "Next step: cd web && npx supabase@latest db push --include-all",
    ].join("\n")
  );
}

const remoteOnly = findRemoteOnlyMigrations({
  localIds: localMigrationIds,
  remoteIds: parsedTable.remoteIds,
});

console.log(`[migrations] Remote is aligned with local (${localMigrationIds.length} migrations).`);
console.log(`[migrations] Latest local migration: ${localMigrationIds.at(-1)}`);

if (remoteOnly.length > 0) {
  console.warn("[migrations] Warning: remote has migrations not present in this checkout:");
  for (const migrationId of remoteOnly) {
    console.warn(`- ${migrationId}`);
  }
}
