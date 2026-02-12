import test from "node:test";
import assert from "node:assert/strict";
import {
  isFeaturedListingActive,
  isPubliclyEligibleFeaturedListing,
} from "@/lib/properties/featured";

void test("featured active logic respects featured flag and expiry", () => {
  const now = new Date("2026-02-12T12:00:00.000Z");
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  assert.equal(isFeaturedListingActive({ is_featured: false }, now), false);
  assert.equal(
    isFeaturedListingActive({ is_featured: true, featured_until: future }, now),
    true
  );
  assert.equal(
    isFeaturedListingActive({ is_featured: true, featured_until: past }, now),
    false
  );
});

void test("featured listings still require public visibility to appear", () => {
  const now = new Date("2026-02-12T12:00:00.000Z");
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const hiddenByApproval = isPubliclyEligibleFeaturedListing(
    {
      is_featured: true,
      featured_until: future,
      status: "live",
      is_active: true,
      is_approved: false,
      expires_at: future,
      is_demo: false,
    },
    { viewerRole: "tenant", now, nodeEnv: "production" }
  );
  assert.equal(hiddenByApproval, false);

  const visible = isPubliclyEligibleFeaturedListing(
    {
      is_featured: true,
      featured_until: future,
      status: "live",
      is_active: true,
      is_approved: true,
      expires_at: future,
      is_demo: false,
    },
    { viewerRole: "tenant", now, nodeEnv: "production" }
  );
  assert.equal(visible, true);
});

void test("demo featured listings remain hidden from non-admin viewers", () => {
  const now = new Date("2026-02-12T12:00:00.000Z");
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const tenantVisible = isPubliclyEligibleFeaturedListing(
    {
      is_featured: true,
      featured_until: future,
      status: "live",
      is_active: true,
      is_approved: true,
      expires_at: future,
      is_demo: true,
    },
    { viewerRole: "tenant", now, nodeEnv: "production" }
  );
  assert.equal(tenantVisible, false);

  const adminVisible = isPubliclyEligibleFeaturedListing(
    {
      is_featured: true,
      featured_until: future,
      status: "live",
      is_active: true,
      is_approved: true,
      expires_at: future,
      is_demo: true,
    },
    { viewerRole: "admin", now, nodeEnv: "production" }
  );
  assert.equal(adminVisible, true);
});
