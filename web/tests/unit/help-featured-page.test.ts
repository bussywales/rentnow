import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ListingsFeaturedHelpPage from "@/app/help/admin/listings/featured/page";

void test("featured listings help page renders required sections", () => {
  const html = renderToStaticMarkup(React.createElement(ListingsFeaturedHelpPage));
  assert.ok(html.includes("What featured listings are"));
  assert.ok(html.includes("How to feature a listing"));
  assert.ok(html.includes("Featured ranking logic"));
});
