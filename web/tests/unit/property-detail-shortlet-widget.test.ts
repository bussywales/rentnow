import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property detail uses unified shortlet classification for booking widget", () => {
  const pagePath = path.join(process.cwd(), "app", "properties", "[id]", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("const isShortletListing = isShortletProperty(property);"),
    "expected detail page shortlet classification to use shared helper"
  );
  assert.ok(
    contents.includes("showPublicActions && !expiredReadOnly && isShortletListing"),
    "expected booking widget gate for shortlet listings"
  );
  assert.ok(
    contents.includes("<ShortletBookingWidget"),
    "expected shortlet booking widget render block in detail page"
  );
});

void test("property detail wiring supports #cta anchor scroll and API shortlet settings", () => {
  const pagePath = path.join(process.cwd(), "app", "properties", "[id]", "page.tsx");
  const routePath = path.join(process.cwd(), "app", "api", "properties", "[id]", "route.ts");
  const pageContents = fs.readFileSync(pagePath, "utf8");
  const routeContents = fs.readFileSync(routePath, "utf8");

  assert.ok(
    pageContents.includes("CtaHashAnchorClient"),
    "expected #cta hash scroll helper on property detail page"
  );
  assert.ok(
    routeContents.includes(
      "shortlet_settings(property_id,booking_mode,nightly_price_minor,cancellation_policy)"
    ),
    "expected property detail API to include shortlet settings payload"
  );
  assert.ok(
    routeContents.includes("cancellation_policy"),
    "expected property detail API to include shortlet cancellation policy"
  );
  assert.ok(
    pageContents.includes("cancellationLabel={shortletCancellationLabel ?? undefined}"),
    "expected booking widget to receive shortlet cancellation label"
  );
  assert.ok(
    pageContents.includes("initialCheckIn={initialShortletCheckIn}"),
    "expected booking widget to receive carried check-in date from shortlets search"
  );
  assert.ok(
    pageContents.includes("initialCheckOut={initialShortletCheckOut}"),
    "expected booking widget to receive carried check-out date from shortlets search"
  );
  assert.ok(
    pageContents.includes("initialGuests={initialShortletGuests}"),
    "expected booking widget to receive carried guests value from shortlets search"
  );
});
