import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";

void test("explore request viewing flow includes attempt/success/fail funnel events", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExploreDetailsSheet.tsx");
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /fetch\("\/api\/viewings\/request"/);
  assert.match(source, /name: "explore_submit_request_attempt"/);
  assert.match(source, /name: "explore_submit_request_success"/);
  assert.match(source, /name: "explore_submit_request_fail"/);
});

void test("explore next steps sheet exposes success and retry affordances", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExploreCtaNextStepsSheet.tsx");
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="explore-request-error-state"/);
  assert.match(source, /data-testid="explore-request-retry"/);
  assert.match(source, /data-testid="explore-request-success-state"/);
  assert.match(source, /data-testid="explore-cta-next-steps-primary"/);
});
