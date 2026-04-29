import test from "node:test";
import assert from "node:assert/strict";

import { getPublicHealthResponse } from "@/app/api/health/route";

test("public health returns only minimal uptime truth", async () => {
  const response = getPublicHealthResponse();

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {
    ok: true,
    service: "propatyhub-web",
  });
  assert.equal("timestamp" in body, false);
  assert.equal("commit" in body, false);
  assert.equal("version" in body, false);
});
