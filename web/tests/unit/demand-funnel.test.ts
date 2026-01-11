import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildDemandFunnelSnapshot } from "@/lib/analytics/demand-funnel";

void test("buildDemandFunnelSnapshot computes conversions and drop-off", () => {
  const snapshot = buildDemandFunnelSnapshot({
    current: { views: 100, saves: 25, enquiries: 10, viewings: 2 },
    previous: { views: 80, saves: 20, enquiries: 5, viewings: 1 },
    availability: {
      views: true,
      saves: true,
      enquiries: true,
      viewings: true,
    },
  });

  const conversions = snapshot.conversions.map((step) => step.rate);
  assert.deepEqual(conversions, [25, 40, 20]);
  assert.equal(snapshot.dropOff?.label, "Enquiries → Viewing requests");
  assert.equal(snapshot.dropOff?.rate, 20);
  assert.equal(snapshot.stages[0].delta, 20);
});

void test("buildDemandFunnelSnapshot marks unavailable steps explicitly", () => {
  const snapshot = buildDemandFunnelSnapshot({
    current: { views: 42, saves: null, enquiries: 0, viewings: null },
    previous: { views: 40, saves: null, enquiries: 0, viewings: null },
    availability: {
      views: true,
      saves: false,
      enquiries: true,
      viewings: false,
    },
  });

  assert.equal(snapshot.conversions[0].available, false);
  assert.equal(snapshot.dropOff?.available, false);
});

void test("demand funnel card includes Not available fallback", () => {
  const cardPath = path.join(process.cwd(), "components", "analytics", "DemandFunnelCard.tsx");
  const contents = fs.readFileSync(cardPath, "utf8");

  assert.ok(
    contents.includes("Not available"),
    "expected Not available copy in funnel card"
  );
});
