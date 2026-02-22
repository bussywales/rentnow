import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(process.cwd(), "app", "host", "earnings", "page.tsx");
const timelineComponentPath = path.join(
  process.cwd(),
  "components",
  "host",
  "HostEarningsTimeline.tsx"
);

void test("host earnings page is wired with summary and tabs timeline view", () => {
  const pageContents = fs.readFileSync(pagePath, "utf8");
  const componentContents = fs.readFileSync(timelineComponentPath, "utf8");

  assert.match(pageContents, /HostEarningsTimelineView/);
  assert.match(pageContents, /Earnings & payouts/);
  assert.match(pageContents, /manual payout processing remains enabled during pilot/i);
  assert.match(componentContents, /Available to payout/);
  assert.match(componentContents, /Paid out/);
  assert.match(componentContents, /Gross earnings/);
  assert.match(componentContents, /Awaiting approval/);
  assert.match(componentContents, /Upcoming stays/);
  assert.match(componentContents, /Available/);
  assert.match(componentContents, /Upcoming/);
  assert.match(componentContents, /Paid/);
  assert.match(componentContents, /All/);
});

void test("host earnings timeline actions are transparent and host-friendly", () => {
  const contents = fs.readFileSync(timelineComponentPath, "utf8");

  assert.match(contents, /Open booking/);
  assert.match(contents, /Request payout/);
  assert.match(contents, /View details/);
  assert.match(contents, /Payouts are processed manually during pilot/);
  assert.match(contents, /No earnings records in this view yet\./);
});
