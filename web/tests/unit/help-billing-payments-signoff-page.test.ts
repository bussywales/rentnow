import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import BillingPaymentsSignoffPage from "@/app/help/admin/support-playbooks/billing-payments-signoff/page";

void test("billing and payments sign-off page captures current closure truth", () => {
  const html = renderToStaticMarkup(React.createElement(BillingPaymentsSignoffPage));

  assert.ok(html.includes("Billing and payments sign-off"));
  assert.ok(html.includes("Current sign-off status: Signed off with explicit constraints"));
  assert.ok(html.includes("United Kingdom — Signed off"));
  assert.ok(html.includes("Canada — Signed off"));
  assert.ok(html.includes("United States — Signed off"));
  assert.ok(html.includes("Nigeria — Signed off with constraints"));
  assert.ok(html.includes("live Stripe runtime is aligned to the PropatyHub Stripe account"));
  assert.ok(html.includes("active CA landlord yearly canonical row now matches the intended final price ref"));
  assert.ok(html.includes("Paystack mode remains test"));
  assert.ok(html.includes("provider-backed market"));
  assert.ok(html.includes("Admin pricing control plane"));
  assert.ok(html.includes("Billing and payments are signed off with explicit constraints"));
});
