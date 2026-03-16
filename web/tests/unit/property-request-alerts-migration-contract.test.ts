import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property request alert preferences migration adds profile toggle", () => {
  const sql = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260316193000_property_request_alert_preferences.sql"
    ),
    "utf8"
  );

  assert.match(
    sql,
    /add column if not exists property_request_alerts_enabled boolean not null default true/i
  );
});
