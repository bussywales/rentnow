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
  assert.ok(html.includes("Nigeria — Not ready for sign-off"));
  assert.ok(html.includes("does not have a live Stripe secret"));
  assert.ok(html.includes("CA landlord yearly canonical row"));
  assert.ok(html.includes("corrected back to the intended final price ref"));
  assert.ok(html.includes("Paystack mode is test"));
  assert.ok(html.includes("provider-backed market"));
  assert.ok(html.includes("Admin pricing control plane"));
});
