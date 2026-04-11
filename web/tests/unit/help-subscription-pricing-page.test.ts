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
  assert.ok(html.includes("Operator status legend"));
  assert.ok(html.includes("Healthy / good"));
  assert.ok(html.includes("Canonical runtime"));
  assert.ok(html.includes("Superseded row history"));
  assert.ok(html.includes("Cross-currency canonical"));
  assert.ok(html.includes("Runtime unavailable"));
  assert.ok(html.includes("Confirm Stripe mode first"));
  assert.ok(html.includes("Never start in Stripe"));
  assert.ok(html.includes("Missing Stripe ref"));
  assert.ok(html.includes("Create and bind the matching Stripe recurring price from the draft"));
  assert.ok(html.includes("Never reuse a stale Stripe price"));
  assert.ok(html.includes("When to stop and escalate"));
  assert.ok(html.includes("How to use activity and history"));
  assert.ok(html.includes("Recent pricing activity on the main control-plane page is only a compact summary"));
  assert.ok(html.includes("Subscription pricing audit log"));
  assert.ok(html.includes("Row history is the filtered lane view"));
  assert.ok(html.includes("Admin pricing control plane"));
});
