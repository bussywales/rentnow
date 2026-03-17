import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

const WORKFLOW_PATH = path.join(
  process.cwd(),
  "..",
  ".github",
  "workflows",
  "property-request-reminders.yml"
);

void test("property request reminders workflow keeps the expected schedule and endpoint", async () => {
  await assert.doesNotReject(async () => fs.access(WORKFLOW_PATH));

  const workflowText = await fs.readFile(WORKFLOW_PATH, "utf8");

  assert.match(workflowText, /name:\s*Property Request Reminders/);
  assert.match(workflowText, /schedule:\s*\n\s*-\s*cron:\s*"?15 7 \* \* \*"?/);
  assert.match(workflowText, /workflow_dispatch:/);
  assert.match(workflowText, /\/api\/internal\/requests\/send-expiry-reminders/);
  assert.match(workflowText, /x-cron-secret:\s*\$\{\{\s*secrets\.CRON_SECRET\s*\}\}/);
  assert.match(workflowText, /concurrency:\s*\n\s*group:\s*property-request-reminders/);
});
