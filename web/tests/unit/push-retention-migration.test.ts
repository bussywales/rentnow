import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("push retention migration defines cleanup function", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "029_push_alert_retention.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    contents.includes("cleanup_push_alerts"),
    "expected cleanup_push_alerts function in migration"
  );
});
