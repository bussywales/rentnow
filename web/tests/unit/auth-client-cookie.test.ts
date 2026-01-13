import test from "node:test";
import assert from "node:assert/strict";

import { writeSupabaseAuthCookie } from "../../lib/auth/client-cookie";

void test("writeSupabaseAuthCookie writes base64 cookie with options", () => {
  const cookies: string[] = [];
  const originalDocument = globalThis.document;

  globalThis.document = {
    set cookie(value: string) {
      cookies.push(value);
    },
    get cookie() {
      return cookies.join("; ");
    },
  } as Document;

  writeSupabaseAuthCookie(
    { access_token: "access", refresh_token: "refresh" },
    {
      name: "sb-test-auth-token",
      domain: ".rentnow.space",
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: 3600,
    }
  );

  const serialized = cookies[0] ?? "";
  assert.ok(serialized.includes("sb-test-auth-token=base64-"));
  assert.ok(serialized.includes("domain=.rentnow.space"));
  assert.ok(serialized.includes("path=/"));
  assert.ok(serialized.includes("samesite=lax"));
  assert.ok(serialized.includes("secure"));
  assert.ok(serialized.includes("max-age=3600"));

  if (typeof originalDocument === "undefined") {
    delete (globalThis as { document?: Document }).document;
  } else {
    globalThis.document = originalDocument;
  }
});

void test("writeSupabaseAuthCookie supports json format", () => {
  const cookies: string[] = [];
  const originalDocument = globalThis.document;

  globalThis.document = {
    set cookie(value: string) {
      cookies.push(value);
    },
  } as Document;

  writeSupabaseAuthCookie(
    { access_token: "access", refresh_token: "refresh" },
    { name: "sb-test-auth-token", format: "json", path: "/", sameSite: "lax" }
  );

  const serialized = cookies[0] ?? "";
  assert.ok(serialized.includes("sb-test-auth-token=%7B"));
  assert.ok(serialized.includes("samesite=lax"));

  if (typeof originalDocument === "undefined") {
    delete (globalThis as { document?: Document }).document;
  } else {
    globalThis.document = originalDocument;
  }
});
