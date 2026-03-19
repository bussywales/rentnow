import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

const WORKFLOW_PATH = path.join(
  process.cwd(),
  "..",
  ".github",
  "workflows",
  "payments-reconcile.yml"
);

const HELPER_SCRIPT_PATH = path.join(
  process.cwd(),
  "..",
  ".github",
  "scripts",
  "call-cron-endpoint.sh"
);

void test("payments reconcile workflow keeps explicit diagnostics and current action runtimes", async () => {
  await assert.doesNotReject(async () => fs.access(WORKFLOW_PATH));
  await assert.doesNotReject(async () => fs.access(HELPER_SCRIPT_PATH));

  const workflowText = await fs.readFile(WORKFLOW_PATH, "utf8");

  assert.match(workflowText, /name:\s*Payments Reconcile/);
  assert.match(workflowText, /schedule:\s*\n\s*-\s*cron:\s*"?\*\/15 \* \* \* \*"?/);
  assert.match(workflowText, /workflow_dispatch:/);
  assert.match(workflowText, /uses:\s*actions\/checkout@v6/);
  assert.match(workflowText, /uses:\s*actions\/setup-node@v6/);
  assert.match(workflowText, /uses:\s*actions\/upload-artifact@v6/);
  assert.match(workflowText, /Validate required secrets/);
  assert.match(workflowText, /Call payments reconcile batch endpoint/);
  assert.match(workflowText, /Call shortlet payments reconcile endpoint/);
  assert.match(workflowText, /call-cron-endpoint\.sh "payments-batch" "\/api\/jobs\/payments\/reconcile"/);
  assert.match(
    workflowText,
    /call-cron-endpoint\.sh "shortlet-reconcile" "\/api\/internal\/shortlet\/reconcile-payments"/
  );
  assert.match(workflowText, /payments-reconcile-failure-artifacts/);
});

void test("payments reconcile cron helper captures safe failure diagnostics", async () => {
  const scriptText = await fs.readFile(HELPER_SCRIPT_PATH, "utf8");

  assert.match(scriptText, /response-body\.json/);
  assert.match(scriptText, /response-headers\.txt/);
  assert.match(scriptText, /curl-verbose\.log/);
  assert.match(scriptText, /metadata\.txt/);
  assert.match(scriptText, /GITHUB_STEP_SUMMARY/);
  assert.match(scriptText, /::error title=Payments reconcile workflow failure::/);
  assert.match(scriptText, /Response body \(first 2048 bytes\)/);
  assert.match(scriptText, /payload\.ok !== true/);
});
