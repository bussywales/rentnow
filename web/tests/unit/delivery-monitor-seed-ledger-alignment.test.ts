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

void test("listing media playback and gallery sync seed stays amber and production-fix focused", () => {
  const item = getDeliveryMonitorSeedItem("listing_media_playback_gallery_sync");

  assert.ok(item);
  assert.equal(item?.status, "amber");
  assert.match(item?.delivered.join(" "), /video visibility signal is fixed/i);
  assert.match(item?.outstanding.join(" "), /active thumbnail must match visible main gallery image/i);
  assert.match(item?.nextAction ?? "", /48161350-b69c-4b39-b7a6-3af29e4e6a44/i);
  assert.match(item?.testingGuide.join(" "), /click thumbnail 2 and thumbnail 3/i);
  assert.match(item?.testingGuide.join(" "), /video tour still appears/i);
});

void test("property request subscriber alerts seed stays amber and validation-focused", () => {
  const item = getDeliveryMonitorSeedItem("property_request_subscriber_alerts");

  assert.ok(item);
  assert.equal(item?.status, "amber");
  assert.match(item?.delivered.join(" "), /criteria-based alert subscriptions/i);
  assert.match(item?.outstanding.join(" "), /live adoption/i);
  assert.match(item?.outstanding.join(" "), /matching quality/i);
});

void test("market pricing control plane seed stays amber and foundation-focused while runtime remains legacy-backed", () => {
  const item = getDeliveryMonitorSeedItem("market_pricing_control_plane");

  assert.ok(item);
  assert.equal(item?.status, "amber");
  assert.match(item?.workstream ?? "", /Billing \/ market pricing \/ entitlements/i);
  assert.match(item?.delivered.join(" "), /Schema foundation exists/i);
  assert.match(item?.delivered.join(" "), /edit seeded market policy rows/i);
  assert.match(item?.delivered.join(" "), /audit history/i);
  assert.match(item?.delivered.join(" "), /legacy settings and code constants/i);
  assert.match(item?.outstanding.join(" "), /runtime checkout/i);
  assert.match(item?.outstanding.join(" "), /Canada PAYG remains policy-gated/i);
  assert.match(item?.testingGuide.join(" "), /market-pricing/i);
  assert.match(item?.testingGuide.join(" "), /edit one policy row, one one-off price row, and one entitlement row/i);
  assert.match(item?.testingGuide.join(" "), /legacy checkout and listing-cap enforcement/i);
});
