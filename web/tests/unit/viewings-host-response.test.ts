import test from "node:test";
import assert from "node:assert/strict";
import { buildHostViewingsPayload } from "@/app/api/viewings/host/route";
import { buildTenantViewingsPayload } from "@/app/api/viewings/tenant/route";

void test("host viewings response includes items alias", () => {
  const viewings = [{ id: "h1" }];
  const payload = buildHostViewingsPayload(viewings);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.viewings, viewings);
  assert.deepEqual(payload.items, viewings);
});

void test("tenant viewings response includes items alias (regression)", () => {
  const viewings = [{ id: "t1" }];
  const payload = buildTenantViewingsPayload(viewings);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.viewings, viewings);
  assert.deepEqual(payload.items, viewings);
});
