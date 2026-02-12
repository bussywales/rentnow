import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  postFeaturedRequestResponse,
  type FeaturedRequestDeps,
} from "@/app/api/featured/requests/route";
import { DEFAULT_FEATURED_ELIGIBILITY_SETTINGS } from "@/lib/featured/eligibility";

function makeRequest(propertyId: string) {
  return new NextRequest("http://localhost/api/featured/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ propertyId, durationDays: 7 }),
  });
}

function makeDeps(input: {
  featuredSettings?: Partial<typeof DEFAULT_FEATURED_ELIGIBILITY_SETTINGS>;
  propertyImages?: number;
}): FeaturedRequestDeps {
  const propertyImagesCount = input.propertyImages ?? 3;
  const client = {
    from: (table: string) => {
      if (table === "properties") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "prop-1",
                  owner_id: "owner-1",
                  title: "Listing",
                  city: "Abuja",
                  status: "live",
                  is_active: true,
                  is_approved: true,
                  expires_at: null,
                  is_demo: false,
                  is_featured: false,
                  featured_until: null,
                  description:
                    "A verified host listing with enough description text to satisfy eligibility.",
                  property_images: Array.from({ length: propertyImagesCount }, (_, index) => ({ id: `img-${index}` })),
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "featured_requests") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: { id: "req-1", property_id: "prop-1" }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  return {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () =>
      ({} as ReturnType<FeaturedRequestDeps["createServerSupabaseClient"]>),
    createServiceRoleClient: () =>
      (client as unknown as ReturnType<FeaturedRequestDeps["createServiceRoleClient"]>),
    requireUser: async () =>
      ({
        ok: true,
        supabase: client,
        user: { id: "owner-1" } as User,
      }) as Awaited<ReturnType<FeaturedRequestDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    hasActiveDelegation: async () => false,
    getFeaturedEligibilitySettings: async () => ({
      ...DEFAULT_FEATURED_ELIGIBILITY_SETTINGS,
      ...(input.featuredSettings ?? {}),
    }),
  };
}

void test("featured requests route returns 403 when requests are disabled", async () => {
  const response = await postFeaturedRequestResponse(
    makeRequest("11111111-1111-4111-8111-111111111111"),
    makeDeps({ featuredSettings: { requestsEnabled: false } })
  );
  assert.equal(response.status, 403);
});

void test("featured requests route returns 409 when listing fails photo minimum", async () => {
  const response = await postFeaturedRequestResponse(
    makeRequest("22222222-2222-4222-8222-222222222222"),
    makeDeps({ propertyImages: 1, featuredSettings: { minPhotos: 3 } })
  );
  assert.equal(response.status, 409);
  const json = await response.json();
  assert.equal(json.error, "Add at least 3 photos.");
});
