import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  postPropertyTransferCreateResponse,
  type CreateDeps,
} from "@/app/api/properties/[id]/transfer/route";

const request = (body: unknown) =>
  new NextRequest("http://localhost/api/properties/property-1/transfer", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

const makeDeps = (overrides: Partial<CreateDeps> = {}): CreateDeps => {
  const supabase = {} as Awaited<ReturnType<CreateDeps["createServerSupabaseClient"]>>;
  return {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () => supabase,
    requireUser: async () => ({ ok: true, user: { id: "owner-1" } as User, supabase }) as Awaited<ReturnType<CreateDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    createListingTransferRequest: async () => ({
      ok: true,
      request: {
        id: "transfer-1",
        property_id: "property-1",
        from_owner_id: "owner-1",
        to_owner_id: "owner-2",
        initiator_user_id: "owner-1",
        recipient_email: "agent@example.com",
        status: "pending",
        created_at: "2026-04-14T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
        expires_at: "2026-04-21T00:00:00.000Z",
      },
    }),
    logFailure: () => undefined,
    ...overrides,
  };
};

void test("create listing transfer requires landlord or agent owner role", async () => {
  const res = await postPropertyTransferCreateResponse(
    request({ recipientEmail: "agent@example.com" }),
    "property-1",
    makeDeps({ getUserRole: async () => "tenant" })
  );
  assert.equal(res.status, 403);
});

void test("create listing transfer returns pending request without changing ownership", async () => {
  const res = await postPropertyTransferCreateResponse(
    request({ recipientEmail: "agent@example.com" }),
    "property-1",
    makeDeps()
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.request.status, "pending");
  assert.equal(body.request.property_id, "property-1");
  assert.equal(body.request.from_owner_id, "owner-1");
  assert.equal(body.request.to_owner_id, "owner-2");
});

void test("create listing transfer surfaces pending-request conflict explicitly", async () => {
  const res = await postPropertyTransferCreateResponse(
    request({ recipientEmail: "agent@example.com" }),
    "property-1",
    makeDeps({
      createListingTransferRequest: async () => ({
        ok: false,
        code: "PENDING_EXISTS",
        error: "This listing already has a pending ownership transfer.",
      }),
    })
  );
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.code, "PENDING_EXISTS");
});
