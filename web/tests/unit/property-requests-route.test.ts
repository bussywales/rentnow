import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  getPropertyRequestsResponse,
  postPropertyRequestsResponse,
  type PropertyRequestsRouteDeps,
} from "@/app/api/requests/route";
import type { PropertyRequestRecord } from "@/lib/requests/property-requests";

function makeGetRequest() {
  return new NextRequest("http://localhost/api/requests", { method: "GET" });
}

function makePostRequest(payload: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const baseRow: PropertyRequestRecord = {
  id: "req-1",
  owner_user_id: "tenant-1",
  owner_role: "tenant",
  intent: "rent",
  market_code: "NG",
  currency_code: "NGN",
  title: "2 bedroom apartment near Lekki",
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
  status: "draft",
  published_at: null,
  expires_at: null,
  created_at: "2026-03-16T10:00:00.000Z",
  updated_at: "2026-03-16T10:00:00.000Z",
};

function buildDeps(
  input: Partial<PropertyRequestsRouteDeps> & { role?: "tenant" | "landlord" | "agent" | "admin" | null } = {}
): PropertyRequestsRouteDeps {
  const role = input.role ?? "tenant";
  return {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () => ({}) as never,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "tenant-1" } as User,
        supabase: {} as never,
      }) as Awaited<ReturnType<PropertyRequestsRouteDeps["requireUser"]>>,
    getUserRole: async () => role,
    listRequests: async () => ({ data: [baseRow], error: null }),
    insertRequest: async () => ({ data: baseRow, error: null }),
    notifyPublishedRequest: async () => ({ ok: true, attempted: 0, sent: 0, skipped: 0 }),
    now: () => new Date("2026-03-16T10:00:00.000Z"),
    ...input,
  };
}

void test("property requests list preserves auth failures", async () => {
  const response = await getPropertyRequestsResponse(makeGetRequest(), {
    ...buildDeps(),
    requireUser: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }) as Awaited<ReturnType<PropertyRequestsRouteDeps["requireUser"]>>,
  });

  assert.equal(response.status, 401);
});

void test("property requests list returns owner scope for tenants", async () => {
  const response = await getPropertyRequestsResponse(makeGetRequest(), buildDeps({ role: "tenant" }));
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.scope, "owner");
  assert.equal(json.items.length, 1);
  assert.equal(json.items[0].ownerUserId, "tenant-1");
});

void test("property requests list returns discover scope for hosts and agents", async () => {
  const response = await getPropertyRequestsResponse(makeGetRequest(), buildDeps({ role: "agent" }));
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.scope, "discover");
});

void test("property requests list passes parsed discover filters to the list layer", async () => {
  let receivedFilters: Record<string, unknown> | null = null;
  const response = await getPropertyRequestsResponse(
    new NextRequest(
      "http://localhost/api/requests?intent=rent&market=NG&propertyType=apartment&bedrooms=2&budgetMin=100000&q=Lekki",
      { method: "GET" }
    ),
    buildDeps({
      role: "agent",
      listRequests: async ({ filters }) => {
        receivedFilters = filters;
        return { data: [baseRow], error: null };
      },
    })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(receivedFilters, {
    q: "Lekki",
    intent: "rent",
    marketCode: "NG",
    propertyType: "apartment",
    bedrooms: 2,
    moveTimeline: null,
    budgetMin: 100000,
    budgetMax: null,
    status: null,
  });
});

void test("property requests create blocks non-tenant roles", async () => {
  const response = await postPropertyRequestsResponse(
    makePostRequest({ status: "draft" }),
    buildDeps({ role: "landlord" })
  );

  assert.equal(response.status, 403);
});

void test("property requests create returns missing-field payload when open request is incomplete", async () => {
  const response = await postPropertyRequestsResponse(
    makePostRequest({ status: "open", intent: "shortlet", marketCode: "NG", currencyCode: "NGN" }),
    buildDeps({ role: "tenant" })
  );
  const json = await response.json();

  assert.equal(response.status, 400);
  assert.equal(json.code, "REQUEST_PUBLISH_FIELDS_MISSING");
  assert.deepEqual(json.missingFields, ["title", "location", "budgetMin", "budgetMax", "shortletDuration"]);
});

void test("property requests create inserts draft rows for tenants", async () => {
  let insertPayload: Record<string, unknown> | null = null;
  const response = await postPropertyRequestsResponse(
    makePostRequest({
      status: "draft",
      marketCode: "NG",
      currencyCode: "NGN",
      city: "Abuja",
      title: "Apartment around Wuse",
      budgetMin: 200000,
      budgetMax: 450000,
    }),
    buildDeps({
      role: "tenant",
      insertRequest: async ({ payload }) => {
        insertPayload = payload;
        return {
          data: {
            ...baseRow,
            city: "Abuja",
            budget_min: 200000,
            budget_max: 450000,
          },
          error: null,
        };
      },
    })
  );
  const json = await response.json();

  assert.equal(response.status, 201);
  assert.equal(insertPayload?.status, "draft");
  assert.equal(json.item.city, "Abuja");
});

void test("property requests create publishes open rows with published and expiry timestamps", async () => {
  let createdRow: PropertyRequestRecord | null = null;
  let notifiedRequestId: string | null = null;
  const response = await postPropertyRequestsResponse(
    makePostRequest({
      status: "open",
      intent: "rent",
      marketCode: "NG",
      currencyCode: "NGN",
      title: "2 bedroom apartment near Lekki",
      city: "Lagos",
      budgetMin: 100000,
      budgetMax: 300000,
    }),
    buildDeps({
      role: "tenant",
      insertRequest: async ({ now }) => {
        createdRow = {
          ...baseRow,
          status: "open",
          published_at: now.toISOString(),
          expires_at: new Date(
            now.getTime() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
        };
        return { data: createdRow, error: null };
      },
      notifyPublishedRequest: async (request) => {
        notifiedRequestId = request.id;
        return { ok: true, attempted: 1, sent: 1, skipped: 0 };
      },
    })
  );
  const json = await response.json();

  assert.equal(response.status, 201);
  assert.equal(json.item.status, "open");
  assert.equal(typeof createdRow?.published_at, "string");
  assert.equal(typeof createdRow?.expires_at, "string");
  assert.equal(notifiedRequestId, "req-1");
});

void test("property requests create does not notify on draft save", async () => {
  let notified = false;
  const response = await postPropertyRequestsResponse(
    makePostRequest({
      status: "draft",
      intent: "rent",
      marketCode: "NG",
      currencyCode: "NGN",
    }),
    buildDeps({
      role: "tenant",
      notifyPublishedRequest: async () => {
        notified = true;
        return { ok: true, attempted: 1, sent: 1, skipped: 0 };
      },
    })
  );

  assert.equal(response.status, 201);
  assert.equal(notified, false);
});
