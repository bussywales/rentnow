import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  getShortletPendingCountResponse,
  type ShortletPendingCountDeps,
} from "../../app/api/shortlet/bookings/pending-count/route";

const makeRequest = () =>
  new NextRequest("http://localhost/api/shortlet/bookings/pending-count", {
    method: "GET",
  });

void test("pending-count returns 0 for non-host roles", async () => {
  let listCallCount = 0;
  const deps: ShortletPendingCountDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "tenant-1" } as never,
        role: "tenant",
        supabase: {} as never,
      }) as Awaited<ReturnType<ShortletPendingCountDeps["requireRole"]>>,
    readActingAsFromRequest: () => null,
    hasActiveDelegation: async () => false,
    listOwnedShortletPropertyIds: async () => {
      listCallCount += 1;
      return [];
    },
    countPendingForProperties: async () => 0,
  };

  const response = await getShortletPendingCountResponse(makeRequest(), deps);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.pendingCount, 0);
  assert.equal(listCallCount, 0);
});

void test("pending-count returns 0 when host has no shortlet listings", async () => {
  let countCallCount = 0;
  const deps: ShortletPendingCountDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "host-1" } as never,
        role: "landlord",
        supabase: {} as never,
      }) as Awaited<ReturnType<ShortletPendingCountDeps["requireRole"]>>,
    readActingAsFromRequest: () => null,
    hasActiveDelegation: async () => false,
    listOwnedShortletPropertyIds: async () => [],
    countPendingForProperties: async () => {
      countCallCount += 1;
      return 5;
    },
  };

  const response = await getShortletPendingCountResponse(makeRequest(), deps);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.pendingCount, 0);
  assert.equal(countCallCount, 0);
});

void test("pending-count returns exact count for host with listings", async () => {
  const deps: ShortletPendingCountDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "host-1" } as never,
        role: "landlord",
        supabase: {} as never,
      }) as Awaited<ReturnType<ShortletPendingCountDeps["requireRole"]>>,
    readActingAsFromRequest: () => null,
    hasActiveDelegation: async () => false,
    listOwnedShortletPropertyIds: async () => ["property-1", "property-2"],
    countPendingForProperties: async (client, propertyIds) => {
      assert.equal(Array.isArray(propertyIds), true);
      assert.equal(propertyIds.length, 2);
      return 3;
    },
  };

  const response = await getShortletPendingCountResponse(makeRequest(), deps);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.pendingCount, 3);
});

void test("pending-count preserves auth failures", async () => {
  const deps: ShortletPendingCountDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }) as Awaited<ReturnType<ShortletPendingCountDeps["requireRole"]>>,
    readActingAsFromRequest: () => null,
    hasActiveDelegation: async () => false,
    listOwnedShortletPropertyIds: async () => [],
    countPendingForProperties: async () => 0,
  };

  const response = await getShortletPendingCountResponse(makeRequest(), deps);
  assert.equal(response.status, 401);
});
