import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
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
  assert.equal(contents.includes("property.description"), false);
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
