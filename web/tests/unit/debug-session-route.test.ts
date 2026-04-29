import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";

import { getDebugSessionResponse } from "@/app/api/debug/session/route";

test("debug session rejects non-admin callers", async () => {
  const response = await getDebugSessionResponse(new Request("http://localhost/api/debug/session"), {
    hasServerSupabaseEnv: () => true,
    authorizeAdmin: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as never,
    getRequestCookies: async () => null,
  });

  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, "Forbidden");
});

test("debug session exposes session diagnostics for admins", async () => {
  const response = await getDebugSessionResponse(
    new Request("http://localhost/api/debug/session", {
      headers: {
        cookie: "sb-access-token=abc; theme=dark",
      },
    }),
    {
      hasServerSupabaseEnv: () => true,
      authorizeAdmin: async () =>
        ({
          ok: true,
          supabase: {
            __bootstrap: { source: "cookie" },
            auth: {
              getUser: async () => ({
                data: {
                  user: {
                    id: "admin-1",
                    email: "admin@example.com",
                  },
                },
                error: null,
              }),
            },
          },
          user: { id: "admin-1" },
          role: "admin",
        }) as never,
      getRequestCookies: async () =>
        ({
          getAll: () => [
            { name: "sb-access-token", value: "abc" },
            { name: "theme", value: "dark" },
          ],
        }) as never,
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ready, true);
  assert.equal(body.sessionUserId, "admin-1");
  assert.deepEqual(body.cookieNames, ["sb-access-token", "theme"]);
  assert.equal(body.headerCookieKeys[0], "sb-access-token");
});
