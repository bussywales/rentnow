import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { postClientPageEnquiryResponse } from "@/app/api/agents/[slug]/c/[clientSlug]/enquire/route";

const makeRequest = () =>
  new NextRequest("http://localhost/api/agents/agent/c/client/enquire", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      propertyId: "listing-1",
      message: "I am interested in this listing.",
      consent: true,
      source: "client_page",
    }),
  });

void test("client page enquiry inserts lead attribution", async () => {
  let attributionPayload: Record<string, unknown> | null = null;
  const listing = {
    id: "listing-1",
    owner_id: "owner-1",
    status: "live",
    title: "Listing",
    city: "Lagos",
    rental_type: "long_term",
    price: 1000,
    currency: "NGN",
    bedrooms: 2,
    bathrooms: 2,
    furnished: false,
  };

  const response = await postClientPageEnquiryResponse(
    makeRequest(),
    { params: Promise.resolve({ slug: "agent", clientSlug: "client" }) },
    {
      hasServerSupabaseEnv: () => true,
      requireUser: async () =>
        ({
          ok: true,
          user: { id: "tenant-1" },
          supabase: {},
        }) as any,
      getUserRole: async () => "tenant",
      requireLegalAcceptance: async () => ({ ok: true, response: {} } as any),
      getAgentClientPagePublic: async () =>
        ({
          ok: true,
          agent: {
            id: "agent-1",
            name: "Agent",
            avatarUrl: null,
            bio: null,
            slug: "agent",
            companyName: null,
            logoUrl: null,
            bannerUrl: null,
            about: null,
          },
          client: {
            id: "page-1",
            slug: "client",
            name: "Client",
            title: null,
            brief: null,
            requirements: null,
            notes: null,
          },
          listings: [listing as any],
          metrics: null,
        }) as any,
      findCuratedListing: () => listing as any,
      createLeadThreadAndMessage: async () =>
        ({
          ok: true,
          lead: { id: "lead-1" },
          threadId: "thread-1",
          message: null,
          leadIntent: "BUY",
        }) as any,
      ensureSessionCookie: () => "session-1",
      logPropertyEvent: async () => ({ ok: true }),
      insertLeadAttribution: async (_client, payload) => {
        attributionPayload = payload as Record<string, unknown>;
        return { ok: true };
      },
      logFailure: () => undefined,
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => ({} as any),
    }
  );

  assert.equal(response.status, 200);
  assert.ok(attributionPayload);
  assert.equal(attributionPayload?.presenting_agent_id, "agent-1");
  assert.equal(attributionPayload?.owner_user_id, "owner-1");
  assert.equal(attributionPayload?.listing_id, "listing-1");
});
