import test from "node:test";
import assert from "node:assert/strict";

import { selectAuthCookieValueFromHeader } from "../../lib/auth/cookie-parser";

const sampleSession = {
  access_token: "access-token",
  refresh_token: "refresh-token",
};

void test("selectAuthCookieValueFromHeader chooses a valid auth cookie", () => {
  const base64 = `base64-${Buffer.from(JSON.stringify(sampleSession)).toString("base64")}`;
  const header = `sb-auth-token=invalid; sb-auth-token=${base64}`;
  const value = selectAuthCookieValueFromHeader(header, "sb-auth-token");
  assert.ok(value?.startsWith("base64-"));
});

void test("selectAuthCookieValueFromHeader returns undefined when no valid cookie", () => {
  const header = "sb-auth-token=invalid";
  const value = selectAuthCookieValueFromHeader(header, "sb-auth-token");
  assert.equal(value, undefined);
});
