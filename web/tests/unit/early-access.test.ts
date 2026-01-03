import test from "node:test";
import assert from "node:assert/strict";

import { getEarlyAccessApprovedBefore } from "../../lib/early-access";

void test("early access gating allows tenant pro and delays free/anon", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const earlyAccessMinutes = 60;

  const tenantPro = getEarlyAccessApprovedBefore({
    role: "tenant",
    hasUser: true,
    planTier: "tenant_pro",
    validUntil: null,
    earlyAccessMinutes,
    now,
  });
  assert.equal(tenantPro.approvedBefore, null);
  assert.equal(tenantPro.isTenantPro, true);

  const tenantFree = getEarlyAccessApprovedBefore({
    role: "tenant",
    hasUser: true,
    planTier: "free",
    validUntil: null,
    earlyAccessMinutes,
    now,
  });
  assert.equal(
    tenantFree.approvedBefore,
    new Date(now - earlyAccessMinutes * 60 * 1000).toISOString()
  );
  assert.equal(tenantFree.isTenantPro, false);
});
