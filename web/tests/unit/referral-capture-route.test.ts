import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";
import { postReferralCaptureResponse } from "@/app/api/referrals/capture/route";

void test("referral capture returns no_cookie when cookie is absent", async () => {
  const response = await postReferralCaptureResponse(
    new Request("http://localhost/api/referrals/capture", { method: "POST" }),
    {
      requireUser: async () =>
        ({
          ok: true,
          user: { id: "user-1" } as never,
          supabase: {} as never,
        }) as never,
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => ({} as never),
      readReferralCodeFromCookieHeader: () => null,
      captureReferralForUser: async () => ({ ok: true, captured: false }),
      getReferralSettings: async () => ({
        enabled: true,
        maxDepth: 5,
        enabledLevels: [1],
        rewardRules: { 1: { type: "listing_credit", amount: 1 } },
        tierThresholds: { Bronze: 0 },
        caps: { daily: 50, monthly: 500 },
      }),
      now: () => 1,
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.reason, "no_cookie");
});

void test("referral capture calls service handler with parsed cookie code", async () => {
  let capturedReferralCode: string | null = null;

  const response = await postReferralCaptureResponse(
    new Request("http://localhost/api/referrals/capture", {
      method: "POST",
      headers: { cookie: "ph_referral_code=AGENT123" },
    }),
    {
      requireUser: async () =>
        ({
          ok: true,
          user: { id: "user-2" } as never,
          supabase: {} as never,
        }) as never,
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => ({ from: () => ({}) } as never),
      readReferralCodeFromCookieHeader: () => "AGENT123",
      captureReferralForUser: async ({ referralCode }) => {
        capturedReferralCode = referralCode;
        return { ok: true, captured: true, depth: 1 };
      },
      getReferralSettings: async () => ({
        enabled: true,
        maxDepth: 5,
        enabledLevels: [1],
        rewardRules: { 1: { type: "listing_credit", amount: 1 } },
        tierThresholds: { Bronze: 0 },
        caps: { daily: 50, monthly: 500 },
      }),
      now: () => 1,
    }
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.captured, true);
  assert.equal(capturedReferralCode, "AGENT123");
});

void test("referral capture returns auth response when user is missing", async () => {
  const response = await postReferralCaptureResponse(
    new Request("http://localhost/api/referrals/capture", { method: "POST" }),
    {
      requireUser: async () =>
        ({
          ok: false,
          response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        }) as never,
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => ({} as never),
      readReferralCodeFromCookieHeader: () => "ABC",
      captureReferralForUser: async () => ({ ok: true, captured: false }),
      getReferralSettings: async () => ({
        enabled: true,
        maxDepth: 5,
        enabledLevels: [1],
        rewardRules: { 1: { type: "listing_credit", amount: 1 } },
        tierThresholds: { Bronze: 0 },
        caps: { daily: 50, monthly: 500 },
      }),
      now: () => 1,
    }
  );

  assert.equal(response.status, 401);
});
