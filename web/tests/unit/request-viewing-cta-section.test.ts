import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RequestViewingCtaSection } from "@/components/viewings/RequestViewingCtaSection";

void test("Viewing CTA renders single primary and single tracking link", () => {
  const html = renderToStaticMarkup(
    React.createElement(RequestViewingCtaSection, {
      propertyId: "prop-123",
      timezoneLabel: "Times shown in city time.",
    })
  );
  const lowerHtml = html.toLowerCase();
  const primaryOccurrences = (lowerHtml.match(/request viewing/g) || []).length;
  const trackOccurrences = (lowerHtml.match(/track viewings/g) || []).length;
  assert.equal(primaryOccurrences, 1);
  assert.equal(trackOccurrences, 1);
  assert.ok(!/view my requests/.test(lowerHtml));
});
