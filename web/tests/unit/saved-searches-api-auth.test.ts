import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";
import {
  getSavedSearchesResponse,
  postSavedSearchResponse,
} from "../../app/api/saved-searches/route";
import {
  deleteSavedSearchByIdResponse,
  patchSavedSearchByIdResponse,
} from "../../app/api/saved-searches/[id]/route";

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const deniedRequireUser = async () =>
  ({ ok: false, response: unauthorizedResponse() }) as const;

void test("GET /api/saved-searches requires authentication", async () => {
  const response = await getSavedSearchesResponse(
    new Request("http://localhost/api/saved-searches"),
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({}) as never,
      requireUser: deniedRequireUser as never,
      getUserRole: async () => "tenant",
      getTenantPlanForTier: (() => null) as never,
      isSavedSearchLimitReached: (() => false) as never,
      logFailure: () => undefined,
      logSavedSearchLimitHit: () => undefined,
    }
  );
  assert.equal(response.status, 401);
});

void test("POST /api/saved-searches requires authentication", async () => {
  const response = await postSavedSearchResponse(
    new Request("http://localhost/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filters: { city: "Lagos" } }),
    }),
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({}) as never,
      requireUser: deniedRequireUser as never,
      getUserRole: async () => "tenant",
      getTenantPlanForTier: (() => null) as never,
      isSavedSearchLimitReached: (() => false) as never,
      logFailure: () => undefined,
      logSavedSearchLimitHit: () => undefined,
    }
  );
  assert.equal(response.status, 401);
});

void test("PATCH /api/saved-searches/[id] requires authentication", async () => {
  const response = await patchSavedSearchByIdResponse(
    new Request("http://localhost/api/saved-searches/test-id", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated name" }),
    }),
    { params: Promise.resolve({ id: "test-id" }) },
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({}) as never,
      requireUser: deniedRequireUser as never,
      searchProperties: (() => null) as never,
      getTenantPlanForTier: (() => null) as never,
    }
  );
  assert.equal(response.status, 401);
});

void test("DELETE /api/saved-searches/[id] requires authentication", async () => {
  const response = await deleteSavedSearchByIdResponse(
    new Request("http://localhost/api/saved-searches/test-id", {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id: "test-id" }) },
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({}) as never,
      requireUser: deniedRequireUser as never,
      searchProperties: (() => null) as never,
      getTenantPlanForTier: (() => null) as never,
    }
  );
  assert.equal(response.status, 401);
});
