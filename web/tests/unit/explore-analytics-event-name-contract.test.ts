import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { EXPLORE_ANALYTICS_EVENT_NAMES } from "@/lib/explore/explore-analytics-event-names";

void test("explore events DB constraint migration includes every API-allowed event name", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260311123000_explore_events_v2_event_names.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    contents.includes("DROP CONSTRAINT IF EXISTS explore_events_event_name_check"),
    "expected migration to replace the existing event-name constraint"
  );
  assert.ok(
    contents.includes("ADD CONSTRAINT explore_events_event_name_check"),
    "expected migration to recreate the event-name constraint"
  );

  for (const eventName of EXPLORE_ANALYTICS_EVENT_NAMES) {
    assert.ok(
      contents.includes(`'${eventName}'`),
      `expected migration constraint to include ${eventName}`
    );
  }
});
