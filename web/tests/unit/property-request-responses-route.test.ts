import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  postPropertyRequestResponse,
  type PropertyRequestResponsesRouteDeps,
} from "@/app/api/requests/[id]/responses/route";
import type { PropertyRequestRecord } from "@/lib/requests/property-requests";

const makePostRequest = (payload: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/requests/req-1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

const listingIdOne = "11111111-1111-4111-8111-111111111111";
const listingIdTwo = "22222222-2222-4222-8222-222222222222";

const openRow: PropertyRequestRecord = {
  id: "req-1",
  owner_user_id: "tenant-1",
  owner_role: "tenant",
  intent: "rent",
  market_code: "NG",
  currency_code: "NGN",
  city: "Lagos",
  area: "Lekki",
  location_text: "Lekki Phase 1",
  budget_min: 100000,
  budget_max: 300000,
  property_type: "apartment",
  bedrooms: 2,
  bathrooms: 2,
  furnished: true,
  move_timeline: "within_30_days",
  shortlet_duration: null,
  notes: "Needs parking",
  status: "open",
  published_at: "2026-03-16T10:00:00.000Z",
  expires_at: "2026-04-15T10:00:00.000Z",
  created_at: "2026-03-16T10:00:00.000Z",
  updated_at: "2026-03-16T10:00:00.000Z",
};

function buildDeps(
  input: Partial<PropertyRequestResponsesRouteDeps> & {
    role?: "tenant" | "landlord" | "agent" | "admin" | null;
    userId?: string;
  } = {}
): PropertyRequestResponsesRouteDeps {
  const role = input.role ?? "agent";
  const userId = input.userId ?? "agent-1";
  return {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () => ({}) as never,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: userId } as User,
        supabase: {} as never,
      }) as Awaited<ReturnType<PropertyRequestResponsesRouteDeps["requireUser"]>>,
    getUserRole: async () => role,
    loadRequest: async () => ({ data: openRow, error: null }),
    createResponse: async () => ({ ok: true, responseId: "response-1" }),
    now: () => new Date("2026-03-16T10:00:00.000Z"),
    ...input,
  };
}

void test("request responses preserve auth failures", async () => {
  const response = await postPropertyRequestResponse(
    makePostRequest({ listingIds: [listingIdOne] }),
    "req-1",
    {
      ...buildDeps(),
      requireUser: async () =>
        ({
          ok: false,
          response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        }) as Awaited<ReturnType<PropertyRequestResponsesRouteDeps["requireUser"]>>,
    }
  );

  assert.equal(response.status, 401);
});

void test("request responses block non-responder roles", async () => {
  const response = await postPropertyRequestResponse(
    makePostRequest({ listingIds: [listingIdOne] }),
    "req-1",
    buildDeps({ role: "tenant", userId: "tenant-1" })
  );

  assert.equal(response.status, 409);
});

void test("request responses hide requests that responders can no longer view", async () => {
  const response = await postPropertyRequestResponse(
    makePostRequest({ listingIds: [listingIdOne] }),
    "req-1",
    buildDeps({
      role: "agent",
      loadRequest: async () => ({
        data: { ...openRow, expires_at: "2026-03-15T10:00:00.000Z" },
        error: null,
      }),
      now: () => new Date("2026-03-16T10:00:00.000Z"),
    })
  );

  assert.equal(response.status, 404);
});

void test("request responses return structured listing validation failures", async () => {
  const response = await postPropertyRequestResponse(
    makePostRequest({ listingIds: [listingIdOne] }),
    "req-1",
    buildDeps({
      createResponse: async () => ({
        ok: false,
        status: 400,
        error: "One or more listings are not eligible for this response.",
        missingListingIds: [listingIdOne],
      }),
    })
  );
  const json = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(json.missingListingIds, [listingIdOne]);
});

void test("request responses return duplicate conflict payloads", async () => {
  const response = await postPropertyRequestResponse(
    makePostRequest({ listingIds: [listingIdOne] }),
    "req-1",
    buildDeps({
      createResponse: async () => ({
        ok: false,
        status: 409,
        error: "You have already sent one or more of these listings to this request.",
        duplicateListingIds: [listingIdOne],
      }),
    })
  );
  const json = await response.json();

  assert.equal(response.status, 409);
  assert.deepEqual(json.duplicateListingIds, [listingIdOne]);
});

void test("request responses create a response for eligible agents", async () => {
  let receivedPayload: Record<string, unknown> | null = null;
  const response = await postPropertyRequestResponse(
    makePostRequest({
      listingIds: [listingIdOne, listingIdTwo],
      message: "These should fit the request.",
    }),
    "req-1",
    buildDeps({
      createResponse: async ({ payload }) => {
        receivedPayload = payload as unknown as Record<string, unknown>;
        return { ok: true, responseId: "response-1" };
      },
    })
  );
  const json = await response.json();

  assert.equal(response.status, 201);
  assert.equal(json.responseId, "response-1");
  assert.deepEqual(receivedPayload, {
    listingIds: [listingIdOne, listingIdTwo],
    message: "These should fit the request.",
  });
});
