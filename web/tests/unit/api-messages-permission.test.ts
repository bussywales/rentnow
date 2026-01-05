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
