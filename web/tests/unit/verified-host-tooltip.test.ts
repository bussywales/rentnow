import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { VERIFIED_HOST_COPY } from "@/components/trust/VerifiedHostInfoTooltip";

const tooltipPath = path.join(process.cwd(), "components", "trust", "VerifiedHostInfoTooltip.tsx");
const shortletsCardPath = path.join(
  process.cwd(),
  "components",
  "shortlets",
  "search",
  "ShortletsSearchListCard.tsx"
);
const trustPillPath = path.join(process.cwd(), "components", "trust", "TrustIdentityPill.tsx");

void test("verified host tooltip copy explains current verification scope", () => {
  assert.ok(VERIFIED_HOST_COPY.includes("at least one verification step"));
  assert.ok(VERIFIED_HOST_COPY.includes("email, phone, or bank"));
});

void test("verified host tooltip trigger is keyboard accessible", () => {
  const contents = fs.readFileSync(tooltipPath, "utf8");

  assert.ok(contents.includes('data-testid="verified-host-tooltip-trigger"'));
  assert.ok(contents.includes("aria-label=\"What does verified mean?\""));
  assert.ok(contents.includes("onKeyDown={(event) => {"));
  assert.ok(contents.includes("event.key !== \"Enter\" && event.key !== \" \""));
  assert.ok(contents.includes("setOpen((current) => !current)"));
  assert.ok(contents.includes('role="dialog"'));
  assert.ok(contents.includes('data-testid="verified-host-tooltip-content"'));
});

void test("shortlets card and trust pill show tooltip alongside verified host badge", () => {
  const cardContents = fs.readFileSync(shortletsCardPath, "utf8");
  const trustPillContents = fs.readFileSync(trustPillPath, "utf8");

  assert.ok(cardContents.includes("badgeLabel === \"Verified host\" ? <VerifiedHostInfoTooltip /> : null"));
  assert.ok(trustPillContents.includes("{verified ? <VerifiedHostInfoTooltip /> : null}"));
});
