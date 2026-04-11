import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SubscriptionPricingPlaybookPage from "@/app/help/admin/support-playbooks/subscription-pricing/page";

void test("subscription pricing playbook explains canonical truth and publish flow", () => {
  const html = renderToStaticMarkup(React.createElement(SubscriptionPricingPlaybookPage));
  assert.ok(html.includes("Canonical pricing truth"));
  assert.ok(html.includes("What publish means"));
  assert.ok(html.includes("Safe price change flow"));
  assert.ok(html.includes("Missing Stripe ref"));
  assert.ok(html.includes("Create and bind the matching Stripe recurring price from the draft"));
  assert.ok(html.includes("old binding must not be reused"));
  assert.ok(html.includes("Admin pricing control plane"));
});
