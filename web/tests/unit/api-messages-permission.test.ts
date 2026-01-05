import test from "node:test";
import assert from "node:assert/strict";

import { buildPermissionResponseBody } from "../../app/api/messages/route";

void test("api messages permission payload includes permission context", () => {
  const body = buildPermissionResponseBody("property_not_accessible", { messages: [] });

  assert.equal(body.code, "property_not_accessible");
  assert.equal(body.permission?.code, "property_not_accessible");
  assert.equal(body.permission?.allowed, false);
  assert.ok(typeof body.permission?.message === "string");
  assert.ok(Array.isArray(body.messages));
});

void test("rate-limited payload includes retry metadata", () => {
  const body = buildPermissionResponseBody("rate_limited", {
    retry_after_seconds: 12,
    cta: { href: "/support", label: "Contact support" },
  });

  assert.equal(body.code, "rate_limited");
  assert.equal(body.reason_code, "rate_limited");
  assert.equal(body.retry_after_seconds, 12);
  assert.deepEqual(body.cta, { href: "/support", label: "Contact support" });
});
