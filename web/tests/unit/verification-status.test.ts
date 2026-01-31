import test from "node:test";
import assert from "node:assert/strict";
import { computeVerificationStatus, deriveOverallStatus } from "@/lib/verification/status";

void test("deriveOverallStatus requires email + phone", () => {
  assert.equal(
    deriveOverallStatus({ email: { verified: true }, phone: { verified: true } }),
    "verified"
  );
  assert.equal(
    deriveOverallStatus({ email: { verified: true }, phone: { verified: false } }),
    "pending"
  );
});

void test("computeVerificationStatus derives flags correctly", () => {
  const status = computeVerificationStatus({
    userId: "user-1",
    emailVerifiedAt: "2025-01-01T00:00:00Z",
    phoneVerifiedAt: null,
    phoneE164: "+447700900000",
    bankVerifiedAt: null,
    bankProvider: null,
  });

  assert.equal(status.email.verified, true);
  assert.equal(status.phone.verified, false);
  assert.equal(status.bank.verified, false);
  assert.equal(status.overall, "pending");
});
