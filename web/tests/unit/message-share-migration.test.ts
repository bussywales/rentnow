import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("share link access tracking migration adds last_accessed_at", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "034_message_thread_shares_last_accessed.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    contents.includes("last_accessed_at"),
    "expected last_accessed_at column in migration"
  );
  assert.ok(
    contents.includes("last_accessed_at = NOW()"),
    "expected last_accessed_at update in migration"
  );
});
