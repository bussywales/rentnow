import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

import {
  postAdminSubscriptionPricingResponse,
  type AdminSubscriptionPricingRouteDeps,
} from "@/app/api/admin/billing/prices/route";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/billing/prices", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function buildDeps(overrides: Partial<AdminSubscriptionPricingRouteDeps> = {}): AdminSubscriptionPricingRouteDeps {
  return {
    hasServiceRoleEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "admin-user" } as User,
        role: "admin",
        supabase: {} as never,
      }) as Awaited<ReturnType<AdminSubscriptionPricingRouteDeps["requireRole"]>>,
    upsertSubscriptionPriceDraft: async () => ({ id: "draft-1" } as never),
    publishSubscriptionPriceDraft: async () => ({ id: "row-1" } as never),
    ...overrides,
  };
}

void test("admin pricing route saves a draft through the control-plane helper", async () => {
  let captured: Record<string, unknown> | null = null;
  const res = await postAdminSubscriptionPricingResponse(
    makeRequest({
      action: "upsert_draft",
      marketCountry: "CA",
      role: "landlord",
      cadence: "monthly",
      currency: "CAD",
      amountMinor: 1999,
      providerPriceRef: "price_123",
      operatorNotes: "Spring update",
    }),
    buildDeps({
      upsertSubscriptionPriceDraft: async (payload) => {
        captured = payload as unknown as Record<string, unknown>;
        return { id: "draft-1" } as never;
      },
    })
  );

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.draftId, "draft-1");
  assert.deepEqual(captured, {
    marketCountry: "CA",
    role: "landlord",
    cadence: "monthly",
    currency: "CAD",
    amountMinor: 1999,
    providerPriceRef: "price_123",
    operatorNotes: "Spring update",
  });
});

void test("admin pricing route publishes a completed draft", async () => {
  let publishedId: string | null = null;
  const res = await postAdminSubscriptionPricingResponse(
    makeRequest({ action: "publish", draftId: "9a2cd2f4-410f-46d3-aeb0-51371f617718" }),
    buildDeps({
      publishSubscriptionPriceDraft: async (draftId) => {
        publishedId = draftId;
        return { id: "row-1" } as never;
      },
    })
  );

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.priceBookId, "row-1");
  assert.equal(publishedId, "9a2cd2f4-410f-46d3-aeb0-51371f617718");
});

void test("admin pricing route returns a safe error when publish validation fails", async () => {
  const res = await postAdminSubscriptionPricingResponse(
    makeRequest({ action: "publish", draftId: "9a2cd2f4-410f-46d3-aeb0-51371f617718" }),
    buildDeps({
      publishSubscriptionPriceDraft: async () => {
        throw new Error("Attach a Stripe recurring price ref before publishing this draft.");
      },
    })
  );

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /Attach a Stripe recurring price ref/);
});
