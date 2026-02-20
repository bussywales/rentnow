import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolveShortletsCardPricing,
  resolveShortletsSearchCardBadge,
  resolveShortletsSearchCardHighlight,
} from "@/components/shortlets/search/ShortletsSearchListCard";

const cardPath = path.join(
  process.cwd(),
  "components",
  "shortlets",
  "search",
  "ShortletsSearchListCard.tsx"
);

void test("shortlets search card keeps a calm hierarchy with stable height and 2-line title clamp", () => {
  const contents = fs.readFileSync(cardPath, "utf8");

  assert.ok(contents.includes("h-full overflow-hidden rounded-2xl"));
  assert.ok(contents.includes("line-clamp-2 min-h-[2.8rem]"));
  assert.ok(contents.includes("min-h-[164px]"));
  assert.ok(contents.includes("Price on request"));
  assert.ok(contents.includes("Fees shown at checkout"));
  assert.ok(contents.includes("Pricing details"));
  assert.equal(contents.includes("property.description"), false);
});

void test("shortlets card exposes accessible save-heart controls without shifting card layout", () => {
  const contents = fs.readFileSync(cardPath, "utf8");

  assert.ok(contents.includes("Save to shortlist"));
  assert.ok(contents.includes("Remove from shortlist"));
  assert.ok(contents.includes("aria-pressed={isSaved}"));
  assert.ok(contents.includes("event.stopPropagation()"));
  assert.ok(contents.includes("absolute right-3 top-3 z-20"));
});

void test("shortlets card highlight prioritises power backup then security then borehole", () => {
  assert.equal(
    resolveShortletsSearchCardHighlight(["wifi", "generator", "security"]),
    "Power backup"
  );
  assert.equal(
    resolveShortletsSearchCardHighlight(["security", "gated estate"]),
    "Security / gated"
  );
  assert.equal(
    resolveShortletsSearchCardHighlight(["borehole water"]),
    "Borehole water"
  );
  assert.equal(resolveShortletsSearchCardHighlight(["wifi"]), null);
});

void test("shortlets card badge follows free-cancellation > verified-host > instant-book priority", () => {
  assert.equal(
    resolveShortletsSearchCardBadge({
      freeCancellation: true,
      verifiedHost: true,
      bookingMode: "instant",
    }),
    "Free cancellation"
  );
  assert.equal(
    resolveShortletsSearchCardBadge({
      freeCancellation: false,
      verifiedHost: true,
      bookingMode: "instant",
    }),
    "Verified host"
  );
  assert.equal(
    resolveShortletsSearchCardBadge({
      freeCancellation: false,
      verifiedHost: false,
      bookingMode: "instant",
    }),
    "Instant book"
  );
});

void test("shortlets card pricing shows nightly label and total when date totals are available", () => {
  const withTotals = resolveShortletsCardPricing({
    currency: "NGN",
    nightlyPriceMinor: 4500000,
    nights: 3,
    subtotal: 135000,
    fees: { serviceFee: 0, cleaningFee: 0, taxes: 0 },
    total: 135000,
  });

  assert.equal(withTotals.nightlyLabel.includes("/ night"), true);
  assert.equal(withTotals.totalLabel?.includes("3 nights"), true);
  assert.equal(withTotals.feesHint, "Fees shown at checkout");
  assert.equal(withTotals.hasBreakdown, true);

  const priceOnRequest = resolveShortletsCardPricing({
    currency: "NGN",
    pricingMode: "price_on_request",
    nightlyPriceMinor: null,
  });
  assert.equal(priceOnRequest.nightlyLabel, "Price on request");
  assert.equal(priceOnRequest.totalLabel, null);
  assert.equal(priceOnRequest.hasBreakdown, false);
});
