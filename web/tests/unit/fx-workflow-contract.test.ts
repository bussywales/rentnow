import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

const WORKFLOW_PATH = path.join(
  process.cwd(),
  "..",
  ".github",
  "workflows",
  "fx-daily-rates.yml"
);

void test("fx daily rates workflow enforces expected schedule and endpoint contract", async () => {
  await assert.doesNotReject(async () => fs.access(WORKFLOW_PATH));

  const workflowText = await fs.readFile(WORKFLOW_PATH, "utf8");

  assert.match(workflowText, /name:\s*FX Daily Rates/);
  assert.match(workflowText, /schedule:\s*\n\s*-\s*cron:\s*"?15 2 \* \* \*"?/);
  assert.match(workflowText, /workflow_dispatch:/);
  assert.match(workflowText, /\/api\/internal\/fx\/fetch-daily/);
  assert.match(workflowText, /x-cron-secret:/);
  assert.match(workflowText, /concurrency:\s*\n\s*group:\s*fx-daily-rates/);
  assert.match(workflowText, /APP_URL="\$\{APP_URL_SECRET:-https:\/\/www\.propatyhub\.com\}"/);
});
