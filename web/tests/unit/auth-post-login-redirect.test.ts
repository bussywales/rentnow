import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePostLoginPath,
  resolvePostLoginRedirect,
} from "@/lib/auth/post-login-redirect";

void test("agent and landlord default post-login destination is /home", () => {
  assert.equal(resolvePostLoginRedirect({ role: "agent" }), "/home");
  assert.equal(resolvePostLoginRedirect({ role: "landlord" }), "/home");
});

void test("tenant and admin default post-login destinations stay role-specific", () => {
  assert.equal(resolvePostLoginRedirect({ role: "tenant" }), "/tenant/home");
  assert.equal(resolvePostLoginRedirect({ role: "admin" }), "/admin");
});

void test("explicit next path is preserved for post-login redirects", () => {
  assert.equal(
    resolvePostLoginRedirect({ role: "landlord", nextPath: "/host/bookings?view=awaiting" }),
    "/host/bookings?view=awaiting"
  );
});

void test("post-login path normalization rejects external redirects", () => {
  assert.equal(normalizePostLoginPath("https://evil.test/path"), "/dashboard");
  assert.equal(normalizePostLoginPath("//evil.test/path"), "/dashboard");
  assert.equal(normalizePostLoginPath("/dashboard"), "/dashboard");
});
