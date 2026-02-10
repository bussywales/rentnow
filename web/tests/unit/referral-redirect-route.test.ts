import test from "node:test";
import assert from "node:assert/strict";
import { getReferralRedirectResponse } from "@/app/r/[code]/route";

void test("referral redirect sets cookies and logs click for valid campaign links", async () => {
  let loggedEvent: Record<string, unknown> | null = null;

  const response = await getReferralRedirectResponse(
    new Request("http://localhost/r/agent123?c=3f7f6034-30cb-40ea-8e36-e59f840d0d39&next=%2Fbrowse&utm_source=whatsapp"),
    "agent123",
    {
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => ({} as never),
      readReferralAnonIdFromCookieHeader: () => null,
      createAnonId: () => "anon-test",
      getReferralTrackingSettings: async () => ({
        enabled: true,
        attributionWindowDays: 30,
        storeIpHash: false,
      }),
      isUuidLike: () => true,
      resolveCampaignIfValid: async () => ({ id: "campaign-1" } as never),
      insertReferralTouchEvent: async (_client, payload) => {
        loggedEvent = payload as Record<string, unknown>;
        return { id: "touch-1" };
      },
      getClientIpFromHeaders: () => null,
      hashIpAddress: () => null,
    }
  );

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/browse?utm_source=whatsapp");

  const cookieHeader = response.headers.get("set-cookie") || "";
  assert.match(cookieHeader, /ph_anon_id=anon-test/i);
  assert.match(cookieHeader, /ph_referral_code=AGENT123/i);
  assert.match(cookieHeader, /ph_referral_campaign_id=campaign-1/i);

  assert.equal(loggedEvent?.referralCode, "AGENT123");
  assert.equal(loggedEvent?.campaignId, "campaign-1");
  assert.equal(loggedEvent?.eventType, "click");
});

void test("referral redirect skips referral cookie for invalid code", async () => {
  const response = await getReferralRedirectResponse(
    new Request("http://localhost/r/invalid!"),
    "invalid!",
    {
      hasServiceRoleEnv: () => false,
      createServiceRoleClient: () => ({} as never),
      readReferralAnonIdFromCookieHeader: () => "anon-existing",
      createAnonId: () => "anon-new",
      getReferralTrackingSettings: async () => ({
        enabled: true,
        attributionWindowDays: 30,
        storeIpHash: false,
      }),
      isUuidLike: () => false,
      resolveCampaignIfValid: async () => null,
      insertReferralTouchEvent: async () => null,
      getClientIpFromHeaders: () => null,
      hashIpAddress: () => null,
    }
  );

  const cookieHeader = response.headers.get("set-cookie") || "";
  assert.match(cookieHeader, /ph_anon_id=anon-existing/i);
  assert.doesNotMatch(cookieHeader, /ph_referral_code=/i);
});
