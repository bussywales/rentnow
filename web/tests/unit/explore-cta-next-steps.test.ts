import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { mockProperties } from "@/lib/mock";
import {
  applyExploreAvailabilityChipToMessage,
  resolveExploreViewingRequestTemplate,
} from "@/lib/explore/explore-presentation";

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

void test("availability chips replace a prior availability line instead of stacking duplicates", () => {
  const base = "Hi, I'd like to request a viewing for Elegant 3 Bed Apartment. Please let me know the next steps.";
  const weekdays = applyExploreAvailabilityChipToMessage(base, "Weekdays");
  assert.match(weekdays, /I'm available on weekdays\./);

  const evenings = applyExploreAvailabilityChipToMessage(weekdays, "Evenings");
  assert.match(evenings, /I'm available in the evenings\./);
  assert.doesNotMatch(evenings, /I'm available on weekdays\./);
});

void test("availability chips keep manual message edits and replace template placeholder", () => {
  const template =
    "Hi, I'd like to request a viewing for Elegant 3 Bed Apartment. I'm available [days/times]. Please let me know the next steps.";
  const anytime = applyExploreAvailabilityChipToMessage(template, "Anytime");
  assert.match(anytime, /I'm flexible on timing\./);
  assert.doesNotMatch(anytime, /\[days\/times\]/);

  const manual = `${anytime}\nAdditional note from tenant.`;
  const weekends = applyExploreAvailabilityChipToMessage(manual, "Weekends");
  assert.match(weekends, /Additional note from tenant\./);
  assert.match(weekends, /I'm available on weekends\./);
  assert.doesNotMatch(weekends, /I'm flexible on timing\./);
});
