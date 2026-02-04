import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AnalyticsHelpPage from "@/app/help/admin/analytics/page";

void test("analytics help page renders required sections", () => {
  const html = renderToStaticMarkup(React.createElement(AnalyticsHelpPage));
  assert.ok(html.includes("Events and signals tracked"));
  assert.ok(html.includes("Supply health quality score"));
  assert.ok(html.includes("Missed demand"));
  assert.ok(html.includes("Featured performance metrics"));
});
