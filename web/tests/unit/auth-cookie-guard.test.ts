import test from "node:test";
import assert from "node:assert/strict";

import { shouldSuppressAuthCookieClear } from "../../lib/auth/cookie-guard";

void test("shouldSuppressAuthCookieClear blocks auth cookie clears", () => {
  const blocked = shouldSuppressAuthCookieClear("sb-123-auth-token", {
    maxAge: 0,
  });
  assert.equal(blocked, true);
});

void test("shouldSuppressAuthCookieClear ignores non-auth cookies", () => {
  const blocked = shouldSuppressAuthCookieClear("rentnow_session", {
    maxAge: 0,
  });
  assert.equal(blocked, false);
});
