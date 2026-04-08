import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

void test("move ready pilot runbook keeps the wedge narrow and operational", () => {
  const contents = read("docs/runbooks/move-ready-pilot-runbook.md");
  assert.ok(contents.includes("Run only one market-country at a time."));
  assert.ok(contents.includes("Run no more than two city/area clusters at once inside that market."));
  assert.ok(contents.includes("No tenant requester flows"));
  assert.ok(contents.includes("No payment or payout flow"));
});

void test("move ready validation scorecard defines hard thresholds", () => {
  const contents = read("docs/runbooks/move-ready-validation-scorecard.md");
  assert.ok(contents.includes("go: `>= 70%`"));
  assert.ok(contents.includes("pause/rework: `< 50%`"));
  assert.ok(contents.includes("provider response rate"));
  assert.ok(contents.includes("unmatched requests older than 2 business days"));
  assert.ok(contents.includes("Do not expand to new requester groups"));
});

void test("move ready stakeholder memo keeps expansion gated", () => {
  const contents = read("docs/runbooks/move-ready-stakeholder-decision-memo.md");
  assert.ok(contents.includes("Decision:"));
  assert.ok(contents.includes("What we are explicitly not doing next"));
  assert.ok(contents.includes("no tenant requester expansion"));
  assert.ok(contents.includes("the next batch must be a wedge-hardening batch"));
});
