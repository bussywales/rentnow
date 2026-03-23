import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  postPropertyCheckinResponse,
  type PropertyCheckinDeps,
} from "../../app/api/properties/[id]/check-in/route";

function makeServiceClient(property?: {
  id?: string;
  owner_id?: string;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const inserts: Array<Record<string, unknown>> = [];
  const propertyRow =
    property === undefined
      ? {
          id: "property-1",
          owner_id: "owner-1",
          latitude: 6.45,
          longitude: 3.4,
        }
      : property;
  return {
    client: {
      from(table: string) {
        if (table === "properties") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: propertyRow
                        ? {
                            id: propertyRow.id ?? "property-1",
                            owner_id: propertyRow.owner_id ?? "owner-1",
                            latitude: propertyRow.latitude ?? 6.45,
                            longitude: propertyRow.longitude ?? 3.4,
                          }
                        : null,
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }

        if (table === "property_checkins") {
          return {
            insert: async (rows: Array<Record<string, unknown>>) => {
              inserts.push(...rows);
              return { error: null };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    },
    inserts,
  };
}

function createDeps(overrides?: Partial<PropertyCheckinDeps>): {
  deps: PropertyCheckinDeps;
  inserts: Array<Record<string, unknown>>;
} {
  const service = makeServiceClient();
  const deps: PropertyCheckinDeps = {
    hasServiceRoleEnv: () => true,
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) as never,
    createServiceRoleClient: () => service.client as never,
    requireUser: async () =>
      ({
        ok: true,
        supabase: { auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never,
        user: { id: "landlord-1" } as never,
      }) as Awaited<ReturnType<PropertyCheckinDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    hasActiveDelegation: async () => false,
    ...overrides,
  };
  return { deps, inserts: service.inserts };
}

void test("property check-in preserves unauthenticated auth response", async () => {
  const { deps } = createDeps({
    requireUser: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }) as Awaited<ReturnType<PropertyCheckinDeps["requireUser"]>>,
  });

  const response = await postPropertyCheckinResponse(
    new NextRequest("http://localhost/api/properties/property-1/check-in", {
      method: "POST",
      body: JSON.stringify({ lat: 6.5, lng: 3.3 }),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ id: "property-1" }) },
    deps
  );

  assert.equal(response.status, 401);
});

void test("property check-in forwards bearer auth and allows delegated agents", async () => {
  let receivedAccessToken: string | null | undefined;
  const { deps, inserts } = createDeps({
    requireUser: async (input) => {
      receivedAccessToken = input.accessToken;
      return {
        ok: true,
        supabase: { auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never,
        user: { id: "agent-1" } as never,
      } as Awaited<ReturnType<PropertyCheckinDeps["requireUser"]>>;
    },
    getUserRole: async () => "agent",
    hasActiveDelegation: async () => true,
  });

  const response = await postPropertyCheckinResponse(
    new NextRequest("http://localhost/api/properties/property-1/check-in", {
      method: "POST",
      body: JSON.stringify({ lat: 6.5, lng: 3.3, accuracy_m: 18 }),
      headers: {
        authorization: "Bearer access-token-123",
        "content-type": "application/json",
      },
    }),
    { params: Promise.resolve({ id: "property-1" }) },
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(receivedAccessToken, "access-token-123");
  assert.equal(body.ok, true);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0]?.verified_by, "agent-1");
  assert.equal(inserts[0]?.role, "agent");
});

void test("property check-in returns truthful listing relation denial for signed-in users", async () => {
  const { deps } = createDeps({
    requireUser: async () =>
      ({
        ok: true,
        supabase: { auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never,
        user: { id: "landlord-2" } as never,
      }) as Awaited<ReturnType<PropertyCheckinDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
  });

  const response = await postPropertyCheckinResponse(
    new NextRequest("http://localhost/api/properties/property-1/check-in", {
      method: "POST",
      body: JSON.stringify({ lat: 6.5, lng: 3.3 }),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ id: "property-1" }) },
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.code, "listing_relation_required");
  assert.match(body.error, /listing owner or a delegated manager/i);
});

void test("property check-in returns truthful role denial for unsupported accounts", async () => {
  const { deps } = createDeps({
    getUserRole: async () => "tenant",
  });

  const response = await postPropertyCheckinResponse(
    new NextRequest("http://localhost/api/properties/property-1/check-in", {
      method: "POST",
      body: JSON.stringify({ lat: 6.5, lng: 3.3 }),
      headers: { "content-type": "application/json" },
    }),
    { params: Promise.resolve({ id: "property-1" }) },
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.code, "role_not_allowed");
  assert.match(body.error, /admins, landlords, and delegated agents/i);
});
