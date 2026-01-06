import test from "node:test";
import assert from "node:assert/strict";

import { buildTrustMarkerSummary } from "../../lib/admin/trust-markers";

void test("buildTrustMarkerSummary counts host verification flags", () => {
  const summary = buildTrustMarkerSummary([
    {
      id: "landlord-1",
      role: "landlord",
      email_verified: true,
      phone_verified: false,
      bank_verified: false,
      reliability_power: "good",
      reliability_water: null,
      reliability_internet: null,
    },
    {
      id: "agent-1",
      role: "agent",
      email_verified: false,
      phone_verified: true,
      bank_verified: true,
      reliability_power: null,
      reliability_water: "fair",
      reliability_internet: null,
    },
    {
      id: "tenant-1",
      role: "tenant",
      email_verified: true,
      phone_verified: true,
      bank_verified: true,
      reliability_power: "excellent",
      reliability_water: "excellent",
      reliability_internet: "excellent",
    },
  ]);

  assert.equal(summary.hostCount, 2);
  assert.equal(summary.emailVerified, 1);
  assert.equal(summary.phoneVerified, 1);
  assert.equal(summary.bankVerified, 1);
  assert.equal(summary.reliabilitySet, 2);
});
