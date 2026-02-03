import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import HostPerformanceHelpPage from "@/app/help/host/performance/page";

void test("host performance help page renders required sections", () => {
  const html = renderToStaticMarkup(React.createElement(HostPerformanceHelpPage));
  assert.ok(html.includes("Featured listings"));
  assert.ok(html.includes("Performance signals"));
  assert.ok(html.includes("Paused listings"));
});
