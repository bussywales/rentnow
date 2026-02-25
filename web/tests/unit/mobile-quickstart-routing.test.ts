import test from "node:test";
import assert from "node:assert/strict";
import { resolveMobileQuickStartSearchHref } from "@/lib/home/mobile-quickstart-routing";

void test("mobile quick-start search defaults to properties browse with open search intent", () => {
  const href = resolveMobileQuickStartSearchHref();
  assert.equal(href, "/properties?open=search");
});

void test("mobile quick-start search prefers shortlets when recent intent indicates shortlet stay", () => {
  const href = resolveMobileQuickStartSearchHref({
    lastSearchParams: "?stay=shortlet&city=Lagos",
  });
  assert.equal(href, "/shortlets?open=search");
});

void test("mobile quick-start search prefers shortlets for shortlet category or intent", () => {
  assert.equal(
    resolveMobileQuickStartSearchHref({
      lastSearchParams: "?category=shortlet",
    }),
    "/shortlets?open=search"
  );
  assert.equal(
    resolveMobileQuickStartSearchHref({
      lastSearchParams: "/properties?intent=shortlet",
    }),
    "/shortlets?open=search"
  );
  assert.equal(
    resolveMobileQuickStartSearchHref({
      lastSearchParams: "?listingIntent=shortlet",
    }),
    "/shortlets?open=search"
  );
});

void test("mobile quick-start search keeps properties route for non-shortlet intent", () => {
  const href = resolveMobileQuickStartSearchHref({
    lastSearchParams: "?intent=rent&city=Abuja",
  });
  assert.equal(href, "/properties?open=search");
});
