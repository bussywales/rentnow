import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";
import { getAccountVerificationResponse } from "@/app/api/account/verification/route";

const unauthorized = async () =>
  ({ ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }) as const;

void test("GET /api/account/verification requires authentication", async () => {
  const response = await getAccountVerificationResponse(
    new Request("http://localhost/api/account/verification"),
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({}) as never,
      requireUser: unauthorized as never,
      getVerificationStatus: async () => ({}) as never,
      getVerificationRequirements: async () => ({}) as never,
    }
  );
  assert.equal(response.status, 401);
});

void test("GET /api/account/verification returns safe verification payload", async () => {
  const response = await getAccountVerificationResponse(
    new Request("http://localhost/api/account/verification"),
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({}) as never,
      requireUser: async () =>
        ({
          ok: true,
          supabase: {} as never,
          user: { id: "user-1" } as never,
        }) as Awaited<ReturnType<typeof unauthorized>>,
      getVerificationStatus: async () =>
        ({
          email: { verified: true },
          phone: { verified: false },
          bank: { verified: false },
        }) as never,
      getVerificationRequirements: async () =>
        ({
          requireEmail: true,
          requirePhone: false,
          requireBank: false,
        }) as never,
    }
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.emailVerified, true);
  assert.equal(payload.phoneVerified, false);
  assert.equal(payload.requireEmail, true);
  assert.equal(payload.isVerificationComplete, true);
  assert.equal("RESEND_API_KEY" in payload, false);
});
