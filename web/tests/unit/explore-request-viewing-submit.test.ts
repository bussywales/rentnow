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
  assert.match(source, /data-testid="explore-request-continue-exploring"/);
  assert.match(source, /data-testid="explore-request-view-requests"/);
  assert.match(source, /if \(!nextOpen && requestSubmitting\) return;/);
  assert.match(source, /data-testid="explore-request-sending-note"/);
  assert.match(source, /data-testid="explore-cta-next-steps-primary"/);
});

void test("explore details sheet guards next-steps close while sending and points to tenant viewings", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExploreDetailsSheet.tsx");
  const source = readFileSync(sourcePath, "utf8");

  assert.match(source, /const viewRequestsHref = "\/tenant\/viewings";/);
  assert.match(source, /if \(!nextOpen && requestSubmitting\) return;/);
  assert.match(source, /onContinueExploring=\{\(\) =>/);
});
