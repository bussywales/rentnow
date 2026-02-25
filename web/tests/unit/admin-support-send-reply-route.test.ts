import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  appendSupportReplyMetadata,
  postAdminSupportRequestReplyResponse,
  type AdminSupportReplyDeps,
} from "@/app/api/admin/support/requests/[id]/reply/route";

function makeRequest(payload: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/support/requests/req-1/reply", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

function makeContext(id = "req-1") {
  return { params: Promise.resolve({ id }) };
}

void test("appendSupportReplyMetadata appends reply audit entries and tracks latest fields", () => {
  const metadata = appendSupportReplyMetadata({
    metadata: { source: "ai_escalation" },
    entry: {
      event: "reply_sent",
      sentAt: "2026-02-25T10:00:00.000Z",
      subject: "We've received your request",
      templateId: "received_request",
      sentBy: "admin-1",
    },
  });

  assert.equal(metadata.lastReplySubject, "We've received your request");
  assert.equal(metadata.lastReplyAt, "2026-02-25T10:00:00.000Z");
  assert.equal(metadata.lastReplyBy, "admin-1");
  assert.ok(Array.isArray(metadata.replyHistory));
  assert.equal((metadata.replyHistory as Array<unknown>).length, 1);
});

void test("admin send reply route preserves auth failures", async () => {
  const deps: AdminSupportReplyDeps = {
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<AdminSupportReplyDeps["requireRole"]>>,
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => ({}) as never,
    createServiceRoleClient: () => ({}) as never,
    now: () => new Date("2026-02-25T10:00:00.000Z"),
    loadRequest: async () => null,
    updateRequestMetadata: async () => null,
    sendEmail: async () => ({ ok: true }),
  };

  const response = await postAdminSupportRequestReplyResponse(
    makeRequest({
      templateId: "received_request",
      subject: "A valid subject",
      body: "A valid body with enough length.",
    }),
    makeContext(),
    deps
  );
  assert.equal(response.status, 403);
});

void test("admin send reply route sends email and updates metadata audit fields", async () => {
  let sentEmail: { to: string; subject: string; html: string } | null = null;
  let updatedMetadata: Record<string, unknown> | null = null;

  const deps: AdminSupportReplyDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<AdminSupportReplyDeps["requireRole"]>>,
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => ({}) as never,
    createServiceRoleClient: () => ({}) as never,
    now: () => new Date("2026-02-25T10:00:00.000Z"),
    loadRequest: async () => ({
      id: "req-1",
      email: "tenant@example.com",
      name: "Tenant User",
      metadata: { escalationReason: "charged_without_booking_no_doc_match" },
    }),
    updateRequestMetadata: async (_client, _id, metadata) => {
      updatedMetadata = metadata;
      return {
        id: "req-1",
        email: "tenant@example.com",
        name: "Tenant User",
        metadata,
      };
    },
    sendEmail: async (input) => {
      sentEmail = input;
      return { ok: true };
    },
  };

  const response = await postAdminSupportRequestReplyResponse(
    makeRequest({
      templateId: "received_request",
      subject: "We've received your request",
      body: "Thanks for your report. We are reviewing this now.",
    }),
    makeContext(),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(sentEmail?.to, "tenant@example.com");
  assert.match(String(sentEmail?.subject || ""), /received your request/i);
  assert.equal(updatedMetadata?.lastReplySubject, "We've received your request");
  assert.equal(updatedMetadata?.lastReplyBy, "admin-1");
  assert.ok(Array.isArray(updatedMetadata?.replyHistory));
});

void test("admin send reply route blocks send when requester email is missing", async () => {
  const deps: AdminSupportReplyDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<AdminSupportReplyDeps["requireRole"]>>,
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => ({}) as never,
    createServiceRoleClient: () => ({}) as never,
    now: () => new Date("2026-02-25T10:00:00.000Z"),
    loadRequest: async () => ({
      id: "req-1",
      email: null,
      name: "Tenant User",
      metadata: {},
    }),
    updateRequestMetadata: async () => null,
    sendEmail: async () => ({ ok: true }),
  };

  const response = await postAdminSupportRequestReplyResponse(
    makeRequest({
      templateId: "need_more_details",
      subject: "Need more details for your request",
      body: "Please share a screenshot and exact time to help us investigate.",
    }),
    makeContext(),
    deps
  );

  assert.equal(response.status, 422);
});
