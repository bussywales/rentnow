import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListingNudges } from "@/components/host/ListingNudges";

void test("ListingNudges renders top suggestions for missing flags", () => {
  const html = renderToStaticMarkup(
    React.createElement(ListingNudges, {
      missingFlags: ["no_photos", "no_price", "short_description", "no_location"],
    })
  );
  const lower = html.toLowerCase();
  assert.ok(lower.includes("add 6+ photos"));
  assert.ok(lower.includes("add a price"));
  assert.ok(lower.includes("expand the description"));
  assert.ok(lower.includes("clearer location"));
});
