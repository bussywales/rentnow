import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";

import { postAdminSentryTestResponse } from "../../app/api/admin/sentry/test/route";

void test("admin sentry test route denies non-admin access", async () => {
  const response = await postAdminSentryTestResponse(
    new Request("http://localhost/api/admin/sentry/test", { method: "POST" }),
    {
      requireAdminRole: async () => ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }),
      captureServerException: () => undefined,
    }
  );

  assert.equal(response.status, 403);
});

void test("admin sentry test route captures a controlled server event for admins", async () => {
  const captured: Array<{ error: unknown; context: Record<string, unknown> }> = [];

  const response = await postAdminSentryTestResponse(
    new Request("http://localhost/api/admin/sentry/test", { method: "POST" }),
    {
      requireAdminRole: async () => ({
        ok: true,
        supabase: {} as never,
        user: { id: "admin-1" },
        role: "admin",
      }),
      captureServerException: (error, context) => {
        captured.push({
          error,
          context: context as unknown as Record<string, unknown>,
        });
      },
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.code, "sentry_server_event_sent");
  assert.equal(captured.length, 1);
  assert.match(String((captured[0]?.error as Error)?.message), /temporary Sentry server verification/i);
  assert.equal(captured[0]?.context.route, "/api/admin/sentry/test");
  assert.equal(captured[0]?.context.userId, "admin-1");
});
