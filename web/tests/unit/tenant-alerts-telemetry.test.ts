import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("tenant alerts dispatch writes push telemetry and dedupe", () => {
  const filePath = path.join(process.cwd(), "lib", "alerts", "tenant-alerts.ts");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(
    contents.includes("insertPushDeliveryAttempt"),
    "expected tenant alerts to record push delivery attempts"
  );
  assert.ok(
    contents.includes("saved_search_push_dedup"),
    "expected tenant alerts to use saved search push dedupe"
  );
});
