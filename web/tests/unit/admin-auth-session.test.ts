import test from "node:test";
import assert from "node:assert/strict";

import {
  extractAuthSessionFromRequest,
  parseSupabaseAuthCookieValue,
  requireAdminRole,
} from "../../lib/auth/admin-session";

const sampleSession = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  token_type: "bearer",
};

void test("parseSupabaseAuthCookieValue handles base64-encoded session", () => {
  const encoded = Buffer.from(JSON.stringify(sampleSession)).toString("base64");
  const parsed = parseSupabaseAuthCookieValue(`base64-${encoded}`);
  assert.equal(parsed?.access_token, sampleSession.access_token);
  assert.equal(parsed?.refresh_token, sampleSession.refresh_token);
});

void test("parseSupabaseAuthCookieValue handles url-encoded json", () => {
  const encoded = encodeURIComponent(JSON.stringify(sampleSession));
  const parsed = parseSupabaseAuthCookieValue(encoded);
  assert.equal(parsed?.access_token, sampleSession.access_token);
  assert.equal(parsed?.refresh_token, sampleSession.refresh_token);
});

void test("extractAuthSessionFromRequest returns null when no cookie present", () => {
  const request = new Request("http://localhost/api/admin/push/test");
  const result = extractAuthSessionFromRequest(request);
  assert.equal(result.session, null);
  assert.equal(result.parseError, false);
});

void test("extractAuthSessionFromRequest picks first valid auth cookie", () => {
  const base64 = `base64-${Buffer.from(JSON.stringify(sampleSession)).toString("base64")}`;
  const request = new Request("http://localhost/api/admin/push/test", {
    headers: {
      cookie: `sb-auth-token=invalid; sb-auth-token=${base64}`,
    },
  });
  const result = extractAuthSessionFromRequest(request);
  assert.equal(result.session?.access_token, sampleSession.access_token);
  assert.equal(result.parseError, false);
});

void test("requireAdminRole does not clear cookies on parse error", async () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";

  const request = new Request("http://localhost/api/admin/push/test", {
    headers: {
      cookie: "sb-auth-token=invalid",
    },
  });
  const result = await requireAdminRole({
    request,
    route: "/api/admin/push/test",
    startTime: Date.now(),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.response.headers.get("set-cookie"), null);
  }

  process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevKey;
});
