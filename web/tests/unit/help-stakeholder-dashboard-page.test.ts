import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import StakeholderDashboardDefinitionsPage from "@/app/help/admin/analytics/stakeholder-dashboard/page";

void test("stakeholder dashboard definitions page explains core metrics and caveats in plain English", () => {
  const html = renderToStaticMarkup(React.createElement(StakeholderDashboardDefinitionsPage));

  assert.ok(html.includes("Stakeholder dashboard definitions"));
  assert.ok(html.includes("Core executive metrics"));
  assert.ok(html.includes("Sessions"));
  assert.ok(html.includes("High-Intent Actions"));
  assert.ok(html.includes("Successful Checkouts"));
  assert.ok(html.includes("Paid Landlords"));
  assert.ok(html.includes("Paid Agents"));
  assert.ok(html.includes("Live Listings"));
  assert.ok(html.includes("Source of truth"));
  assert.ok(html.includes("How to read this dashboard"));
  assert.ok(html.includes("Common misreads and cautions"));
  assert.ok(html.includes("Do not mix denominators casually"));
});
