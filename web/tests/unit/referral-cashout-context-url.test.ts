import test from "node:test";
import assert from "node:assert/strict";
import { buildAdminReferralAttributionContextUrl } from "@/lib/referrals/cashout-context";

void test("buildAdminReferralAttributionContextUrl uses requested_at ± date window", () => {
  const url = buildAdminReferralAttributionContextUrl({
    referrerUserId: "00000000-0000-0000-0000-000000000111",
    requestedAt: "2026-02-12T11:30:00.000Z",
  });

  assert.equal(
    url,
    "/admin/referrals/attribution?referrer=00000000-0000-0000-0000-000000000111&from=2026-01-29&to=2026-02-13"
  );
});

void test("buildAdminReferralAttributionContextUrl skips date params when requested_at is invalid", () => {
  const url = buildAdminReferralAttributionContextUrl({
    referrerUserId: "00000000-0000-0000-0000-000000000111",
    requestedAt: "not-a-date",
  });

  assert.equal(url, "/admin/referrals/attribution?referrer=00000000-0000-0000-0000-000000000111");
});

