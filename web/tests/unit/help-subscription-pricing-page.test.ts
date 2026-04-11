import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SubscriptionPricingPlaybookPage from "@/app/help/admin/support-playbooks/subscription-pricing/page";

void test("subscription pricing sop explains the safe operating flow in plain English", () => {
  const html = renderToStaticMarkup(React.createElement(SubscriptionPricingPlaybookPage));
  assert.ok(html.includes("Subscription pricing SOP"));
  assert.ok(html.includes("What this page is for"));
  assert.ok(html.includes("Safe subscription price change flow"));
  assert.ok(html.includes("Confirm Stripe mode first"));
  assert.ok(html.includes("Never start in Stripe"));
  assert.ok(html.includes("Missing Stripe ref"));
  assert.ok(html.includes("Create and bind the matching Stripe recurring price from the draft"));
  assert.ok(html.includes("Never reuse a stale Stripe price"));
  assert.ok(html.includes("When to stop and escalate"));
  assert.ok(html.includes("Admin pricing control plane"));
});
