import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  postListingTransferRespondResponse,
  type RespondDeps,
} from "@/app/api/listing-transfers/[id]/respond/route";

const request = (body: unknown) =>
  new NextRequest("http://localhost/api/listing-transfers/transfer-1/respond", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

const makeDeps = (overrides: Partial<RespondDeps> = {}): RespondDeps => {
  const supabase = {} as Awaited<ReturnType<RespondDeps["createServerSupabaseClient"]>>;
  return {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () => supabase,
    requireUser: async () => ({ ok: true, user: { id: "recipient-1" } as User, supabase }) as Awaited<ReturnType<RespondDeps["requireUser"]>>,
    getUserRole: async () => "agent",
    respondToListingTransferRequest: async () => ({
      ok: true,
      request: {
        id: "transfer-1",
        property_id: "property-1",
        from_owner_id: "owner-1",
        to_owner_id: "recipient-1",
        initiator_user_id: "owner-1",
        recipient_email: "recipient@example.com",
        status: "accepted",
        created_at: "2026-04-14T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
        responded_at: "2026-04-14T00:10:00.000Z",
        expires_at: "2026-04-21T00:00:00.000Z",
      },
    }),
    logFailure: () => undefined,
    ...overrides,
  };
};

void test("accept transfer succeeds only after explicit recipient action", async () => {
  const res = await postListingTransferRespondResponse(
    request({ action: "accept" }),
    "transfer-1",
    makeDeps()
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.request.status, "accepted");
});

void test("reject keeps the listing with the current owner", async () => {
  const res = await postListingTransferRespondResponse(
    request({ action: "reject" }),
    "transfer-1",
    makeDeps({
      respondToListingTransferRequest: async () => ({
        ok: true,
        request: {
          id: "transfer-1",
          property_id: "property-1",
          from_owner_id: "owner-1",
          to_owner_id: "recipient-1",
          initiator_user_id: "owner-1",
          recipient_email: "recipient@example.com",
          status: "rejected",
          created_at: "2026-04-14T00:00:00.000Z",
          updated_at: "2026-04-14T00:00:00.000Z",
          responded_at: "2026-04-14T00:10:00.000Z",
          expires_at: "2026-04-21T00:00:00.000Z",
        },
      }),
    })
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.request.status, "rejected");
  assert.equal(body.request.from_owner_id, "owner-1");
});

void test("accept transfer surfaces billing enforcement failures explicitly", async () => {
  const res = await postListingTransferRespondResponse(
    request({ action: "accept" }),
    "transfer-1",
    makeDeps({
      respondToListingTransferRequest: async () => ({
        ok: false,
        code: "PAYMENT_REQUIRED",
        error: "You need listing credits before accepting this transfer.",
        billingUrl: "/dashboard/billing#plans",
        reason: "PAYMENT_REQUIRED",
        amount: 2000,
        currency: "NGN",
      }),
    })
  );
  assert.equal(res.status, 402);
  const body = await res.json();
  assert.equal(body.code, "PAYMENT_REQUIRED");
  assert.equal(body.billingUrl, "/dashboard/billing#plans");
});
