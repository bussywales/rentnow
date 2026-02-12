import test from "node:test";
import assert from "node:assert/strict";
import {
  computeUserAgentHash,
  deriveCashoutRiskFlags,
  resolveCashoutRiskLevel,
} from "@/lib/referrals/cashout-risk.server";

void test("user agent hashing is deterministic and case-insensitive", () => {
  const a = computeUserAgentHash("Mozilla/5.0 Test Agent");
  const b = computeUserAgentHash("mozilla/5.0 test agent");
  assert.ok(a);
  assert.equal(a, b);
});

void test("risk rules map to expected levels", () => {
  const none = resolveCashoutRiskLevel({
    ipCluster: false,
    uaCluster: false,
    rapidCaptures: false,
    deepChain: false,
    geoMismatch: false,
  });
  assert.equal(none, "none");

  const low = resolveCashoutRiskLevel({
    ipCluster: false,
    uaCluster: false,
    rapidCaptures: true,
    deepChain: false,
    geoMismatch: false,
  });
  assert.equal(low, "low");

  const medium = resolveCashoutRiskLevel({
    ipCluster: true,
    uaCluster: false,
    rapidCaptures: false,
    deepChain: false,
    geoMismatch: false,
  });
  assert.equal(medium, "medium");

  const high = resolveCashoutRiskLevel({
    ipCluster: true,
    uaCluster: false,
    rapidCaptures: true,
    deepChain: false,
    geoMismatch: false,
  });
  assert.equal(high, "high");
});

void test("risk flags are emitted for every triggered signal", () => {
  const flags = deriveCashoutRiskFlags({
    ipCluster: true,
    uaCluster: true,
    rapidCaptures: true,
    deepChain: true,
    geoMismatch: false,
  });

  assert.deepEqual(flags, ["ip_cluster", "ua_cluster", "rapid_captures", "deep_chain"]);
});
