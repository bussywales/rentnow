import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import BillingPaymentsSignoffPage from "@/app/help/admin/support-playbooks/billing-payments-signoff/page";

void test("billing and payments sign-off page captures current closure truth", () => {
  const html = renderToStaticMarkup(React.createElement(BillingPaymentsSignoffPage));

  assert.ok(html.includes("Billing and payments sign-off"));
  assert.ok(html.includes("Current sign-off status: Not ready for final sign-off"));
  assert.ok(html.includes("United Kingdom — Not ready for sign-off"));
  assert.ok(html.includes("Canada — Not ready for sign-off"));
  assert.ok(html.includes("United States — Not ready for sign-off"));
  assert.ok(html.includes("Nigeria — Signed off with constraints"));
  assert.ok(html.includes("the current live Stripe configuration cannot retrieve the canonical Stripe price refs"));
  assert.ok(html.includes("CA landlord yearly row"));
  assert.ok(html.includes("wrong Stripe price"));
  assert.ok(html.includes("current provider mode is test"));
  assert.ok(html.includes("provider-backed market"));
  assert.ok(html.includes("Admin pricing control plane"));
});
