import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { mockProperties } from "@/lib/mock";
import { resolveExploreViewingRequestTemplate } from "@/lib/explore/explore-presentation";

void test("resolveExploreViewingRequestTemplate includes listing title and editable availability placeholder", () => {
  const property = {
    ...mockProperties[0],
    title: "Elegant 3 Bed Apartment",
  };

  const message = resolveExploreViewingRequestTemplate(property);
  assert.match(message, /Elegant 3 Bed Apartment/);
  assert.match(message, /\[days\/times\]/);
});

void test("explore details CTA flow includes next-steps sheet and request message composer", () => {
  const detailsSourcePath = path.join(process.cwd(), "components", "explore", "ExploreDetailsSheet.tsx");
  const sheetSourcePath = path.join(process.cwd(), "components", "explore", "ExploreCtaNextStepsSheet.tsx");
  const detailsSource = readFileSync(detailsSourcePath, "utf8");
  const sheetSource = readFileSync(sheetSourcePath, "utf8");

  assert.match(detailsSource, /ExploreCtaNextStepsSheet/);
  assert.match(detailsSource, /data-testid="explore-primary-cta"/);
  assert.match(sheetSource, /testId="explore-cta-next-steps-sheet"/);
  assert.match(sheetSource, /data-testid="explore-request-message"/);
  assert.match(sheetSource, /data-testid="explore-request-availability-chip"/);
});
