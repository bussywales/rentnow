import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ListingsStatusesHelpPage from "@/app/help/admin/listings/statuses/page";

const STATUSES = [
  "draft",
  "pending",
  "live",
  "rejected",
  "changes_requested",
  "paused_owner",
  "paused_occupied",
  "expired",
];

void test("statuses page renders all status headings", () => {
  const html = renderToStaticMarkup(React.createElement(ListingsStatusesHelpPage));
  for (const status of STATUSES) {
    assert.ok(html.includes(`help-status-${status}`), `missing status card for ${status}`);
  }
});

void test("statuses quick table includes all statuses", () => {
  const html = renderToStaticMarkup(React.createElement(ListingsStatusesHelpPage));
  for (const status of STATUSES) {
    assert.ok(html.includes(`help-status-row-${status}`), `missing table row for ${status}`);
  }
});
