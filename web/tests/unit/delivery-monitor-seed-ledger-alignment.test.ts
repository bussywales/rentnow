import test from "node:test";
import assert from "node:assert/strict";
import { getDeliveryMonitorSeedItem } from "@/lib/admin/delivery-monitor-seed";

void test("canada market segmentation seed stays policy-gated and red while ledger remains pre-implementation", () => {
  const item = getDeliveryMonitorSeedItem("canada_market_segmentation");

  assert.ok(item);
  assert.equal(item?.status, "red");
  assert.equal(item?.workstream, "Canada market segmentation policy + implementation");
  assert.match(item?.description ?? "", /policy-gated/i);
  assert.match(item?.delivered.join(" "), /shared multi-market plumbing/i);
  assert.match(item?.outstanding.join(" "), /pricing/i);
  assert.match(item?.outstanding.join(" "), /tax/i);
  assert.match(item?.outstanding.join(" "), /provider routing/i);
  assert.match(item?.outstanding.join(" "), /entitlements?/i);
  assert.match(item?.outstanding.join(" "), /moderation/i);
  assert.match(item?.outstanding.join(" "), /launch scope/i);
  assert.match(item?.nextAction ?? "", /canada-market-segmentation-policy\.md/i);
  assert.doesNotMatch(item?.description ?? "", /rollout-ready|launch-ready|operationally ready/i);
  assert.doesNotMatch(item?.testingGuide.join(" "), /verify CAD pricing resolves/i);
});

void test("listing monetisation seed stays validation-focused after repo-truth harness hardening", () => {
  const item = getDeliveryMonitorSeedItem("listing_publish_renew_recovery");

  assert.ok(item);
  assert.equal(item?.status, "amber");
  assert.match(item?.delivered.join(" "), /structured recovery contracts/i);
  assert.match(item?.outstanding.join(" "), /payment-provider callback/i);
  assert.match(item?.outstanding.join(" "), /live/i);
});

void test("property request subscriber alerts seed stays amber and validation-focused", () => {
  const item = getDeliveryMonitorSeedItem("property_request_subscriber_alerts");

  assert.ok(item);
  assert.equal(item?.status, "amber");
  assert.match(item?.delivered.join(" "), /criteria-based alert subscriptions/i);
  assert.match(item?.outstanding.join(" "), /live adoption/i);
  assert.match(item?.outstanding.join(" "), /matching quality/i);
});
