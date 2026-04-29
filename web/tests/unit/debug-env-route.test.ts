import test from "node:test";
import assert from "node:assert/strict";

import { getDeprecatedDebugEnvResponse } from "@/app/api/debug/env/route";

test("debug env route is deprecated and no longer exposes readiness details", async () => {
  const response = getDeprecatedDebugEnvResponse();

  assert.equal(response.status, 410);
  const body = await response.json();
  assert.deepEqual(body, {
    ok: false,
    error: "Gone",
  });
});
