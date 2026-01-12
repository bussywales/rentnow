import test from "node:test";
import assert from "node:assert/strict";

import {
  extractAuthSessionFromRequest,
  parseSupabaseAuthCookieValue,
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
