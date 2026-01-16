import test from "node:test";
import assert from "node:assert/strict";
import { buildTenantViewingsPayload } from "@/app/api/viewings/tenant/route";

void test("tenant viewings response includes items alias", () => {
  const viewings = [{ id: "1" }];
  const payload = buildTenantViewingsPayload(viewings);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.viewings, viewings);
  assert.deepEqual(payload.items, viewings);
});
