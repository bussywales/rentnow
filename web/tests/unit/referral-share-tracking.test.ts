import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getReferralOwnerAnalytics,
  normalizeCampaignInput,
  normalizeLandingPath,
  upsertReferralAttribution,
} from "@/lib/referrals/share-tracking.server";

type Row = Record<string, unknown>;

function makeChain(rows: Row[]) {
  let current = [...rows];
  const chain = {
    eq(column: string, value: unknown) {
      current = current.filter((row) => row[column] === value);
      return chain;
    },
    order() {
      return chain;
    },
    limit(value: number) {
      current = current.slice(0, value);
      return chain;
    },
    async maybeSingle<T>() {
      return { data: (current[0] as T | undefined) ?? null, error: null };
    },
    then(onFulfilled: (value: { data: Row[]; error: null }) => unknown) {
      return Promise.resolve({ data: current, error: null }).then(onFulfilled);
    },
  };
  return chain;
}

void test("normalizeCampaignInput validates channel and landing path", () => {
  const ok = normalizeCampaignInput({
    name: "WhatsApp Lagos agents",
    channel: "whatsapp",
    landing_path: "/get-started",
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.value.channel, "whatsapp");
  assert.equal(ok.value.landing_path, "/get-started");

  const invalid = normalizeCampaignInput({
    name: "Invalid",
    channel: "fax",
  });
  assert.equal(invalid.ok, false);

  assert.equal(normalizeLandingPath("https://evil.com"), "/");
  assert.equal(normalizeLandingPath("/browse?city=abuja"), "/browse?city=abuja");
});

void test("upsertReferralAttribution uses referred_user_id conflict target", async () => {
  let capturedOnConflict = "";
  let capturedPayload: Record<string, unknown> | null = null;

  const client = {
    from: (table: string) => {
      assert.equal(table, "referral_attributions");
      return {
        upsert: (payload: Record<string, unknown>, options: { onConflict: string }) => {
          capturedPayload = payload;
          capturedOnConflict = options.onConflict;
          return {
            select: () => ({
              maybeSingle: async () => ({ data: payload, error: null }),
            }),
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  const row = await upsertReferralAttribution({
    client,
    campaignId: "campaign-1",
    referralCode: "ABC123",
    referredUserId: "user-1",
    referrerOwnerId: "owner-1",
    firstTouchEventId: "touch-1",
    capturedEventId: "touch-2",
  });

  assert.equal(capturedOnConflict, "referred_user_id");
  assert.equal((capturedPayload?.referred_user_id as string) ?? "", "user-1");
  assert.equal(row?.referred_user_id, "user-1");
});

void test("getReferralOwnerAnalytics aggregates clicks, captures and earnings", async () => {
  const campaigns: Row[] = [
    {
      id: "campaign-1",
      owner_id: "owner-1",
      referral_code: "ABC123",
      name: "WhatsApp push",
      channel: "whatsapp",
      utm_source: "whatsapp",
      utm_medium: "social",
      utm_campaign: "feb",
      utm_content: null,
      landing_path: "/get-started",
      is_active: true,
      created_at: "2026-02-10T00:00:00.000Z",
      updated_at: "2026-02-10T00:00:00.000Z",
    },
  ];

  const touches: Row[] = [
    {
      id: "touch-1",
      campaign_id: "campaign-1",
      referral_code: "ABC123",
      event_type: "click",
      referred_user_id: null,
      country_code: "NG",
      created_at: "2026-02-10T01:00:00.000Z",
    },
    {
      id: "touch-2",
      campaign_id: "campaign-1",
      referral_code: "ABC123",
      event_type: "click",
      referred_user_id: null,
      country_code: "NG",
      created_at: "2026-02-10T02:00:00.000Z",
    },
  ];

  const attributions: Row[] = [
    {
      id: "attr-1",
      campaign_id: "campaign-1",
      referral_code: "ABC123",
      referred_user_id: "referred-1",
      referrer_owner_id: "owner-1",
      first_touch_event_id: "touch-1",
      captured_event_id: "touch-3",
      created_at: "2026-02-10T03:00:00.000Z",
    },
  ];

  const rewards: Row[] = [
    { referrer_user_id: "owner-1", referred_user_id: "referred-1", reward_amount: 2 },
  ];

  const client = {
    from: (table: string) => {
      if (table === "referral_share_campaigns") {
        return {
          select: () => makeChain(campaigns),
        };
      }
      if (table === "referral_touch_events") {
        return {
          select: () => makeChain(touches),
        };
      }
      if (table === "referral_attributions") {
        return {
          select: () => makeChain(attributions),
        };
      }
      if (table === "referral_rewards") {
        return {
          select: () => makeChain(rewards),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;

  const result = await getReferralOwnerAnalytics({ client, ownerId: "owner-1" });

  assert.equal(result.totals.clicks, 2);
  assert.equal(result.totals.captures, 1);
  assert.equal(result.totals.activeReferrals, 1);
  assert.equal(result.totals.earningsCredits, 2);
  assert.equal(result.campaigns[0]?.conversionRate, 50);
});
