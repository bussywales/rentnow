import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { selectHostFeaturedStripListings } from "@/lib/host/featured-strip";

type StubListing = {
  id: string;
  title: string;
  price: number;
  currency: string;
  is_featured?: boolean | null;
  featured_until?: string | null;
  featured_rank?: number | null;
  created_at?: string;
  updated_at?: string;
};

function createStubListing(
  id: string,
  overrides: Partial<StubListing> = {}
): StubListing {
  return {
    id,
    title: id,
    price: 100000,
    currency: "NGN",
    created_at: "2026-02-01T00:00:00.000Z",
    updated_at: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

void test("featured strip selection caps results to 6 and prioritises active featured rows", () => {
  const nowIso = "2026-02-23T12:00:00.000Z";
  const nowMs = Date.parse(nowIso);
  const listings = [
    createStubListing("fallback-1", { updated_at: "2026-02-18T00:00:00.000Z" }),
    createStubListing("featured-2", {
      is_featured: true,
      featured_rank: 2,
      featured_until: "2026-03-01T00:00:00.000Z",
      updated_at: "2026-02-20T00:00:00.000Z",
    }),
    createStubListing("fallback-2", { updated_at: "2026-02-17T00:00:00.000Z" }),
    createStubListing("featured-1", {
      is_featured: true,
      featured_rank: 1,
      featured_until: "2026-03-02T00:00:00.000Z",
      updated_at: "2026-02-21T00:00:00.000Z",
    }),
    createStubListing("expired-featured", {
      is_featured: true,
      featured_until: "2026-02-10T00:00:00.000Z",
      updated_at: "2026-02-22T00:00:00.000Z",
    }),
    createStubListing("fallback-3", { updated_at: "2026-02-16T00:00:00.000Z" }),
    createStubListing("fallback-4", { updated_at: "2026-02-15T00:00:00.000Z" }),
    createStubListing("fallback-5", { updated_at: "2026-02-14T00:00:00.000Z" }),
  ] as never[];

  const selected = selectHostFeaturedStripListings(listings, nowMs);
  assert.equal(selected.length, 6);
  assert.equal(selected[0]?.id, "featured-1");
  assert.equal(selected[1]?.id, "featured-2");
  assert.notEqual(selected[0]?.id, "expired-featured");
  assert.notEqual(selected[1]?.id, "expired-featured");
});

void test("featured strip component uses native snap rail and fixed-cover media", () => {
  const stripPath = path.join(process.cwd(), "components", "host", "HostFeaturedStrip.tsx");
  const stripSource = fs.readFileSync(stripPath, "utf8");

  assert.match(stripSource, /selectHostFeaturedStripListings/);
  assert.match(stripSource, /snap-x snap-mandatory/);
  assert.match(stripSource, /overflow-x-auto/);
  assert.match(stripSource, /scrollbar-none/);
  assert.match(stripSource, /resolveStableListingImageSrc/);
  assert.match(stripSource, /scroll-px-4/);
  assert.match(stripSource, /sm:scroll-px-6/);
  assert.match(stripSource, /px-4/);
  assert.match(stripSource, /sm:px-6/);
  assert.match(stripSource, /aspect-\[4\/3\]/);
  assert.match(stripSource, /object-cover/);
  assert.match(stripSource, /w-\[220px\].*sm:w-\[240px\].*lg:w-\[280px\]/s);
  assert.match(stripSource, /snap-start/);
  assert.match(stripSource, /snap-always/);
  assert.doesNotMatch(stripSource, /animate-pulse/);
  assert.match(stripSource, /key=\{`listing-image-\$\{listing\.id\}`\}/);
  assert.match(stripSource, /w-4 shrink-0 sm:w-6/);
});

void test("host listings feed renders featured strip only for view=all", () => {
  const feedPath = path.join(process.cwd(), "components", "host", "HostListingsFeed.tsx");
  const feedSource = fs.readFileSync(feedPath, "utf8");

  assert.match(feedSource, /parseHostDashboardView/);
  assert.match(feedSource, /dashboardView === "all"/);
  assert.match(feedSource, /<HostFeaturedStrip listings=\{listings\} \/>/);
});

void test("featured strip polish includes fade edges and desktop-only overflow arrows", () => {
  const stripPath = path.join(process.cwd(), "components", "host", "HostFeaturedStrip.tsx");
  const stripSource = fs.readFileSync(stripPath, "utf8");

  assert.match(stripSource, /hasOverflow \? \(/);
  assert.match(stripSource, /md:inline-flex md:group-hover:opacity-100/);
  assert.match(stripSource, /bg-gradient-to-r from-white to-transparent/);
  assert.match(stripSource, /bg-gradient-to-l from-white to-transparent/);
  assert.match(stripSource, /View all/);
  assert.match(stripSource, /host-home-listings-grid/);
});
