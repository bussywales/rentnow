import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";

type PlanRow = {
  id: string;
  role: string | null;
  tier: string | null;
  listing_credits: number | null;
  featured_credits: number | null;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_subscription_id: string;
  status: string | null;
  plan_tier: string | null;
  role: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
};

export async function upsertSubscriptionRecord({
  adminClient,
  userId,
  provider,
  providerSubscriptionId,
  status,
  planTier,
  currentPeriodStart,
  currentPeriodEnd,
  canceledAt,
}: {
  adminClient: SupabaseClient;
  userId: string;
  provider: string;
  providerSubscriptionId: string;
  status: string | null;
  planTier: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  canceledAt?: string | null;
}): Promise<SubscriptionRow | null> {
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = profile?.role ?? null;
  const now = new Date().toISOString();
  const { data, error } = await adminClient
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        provider,
        provider_subscription_id: providerSubscriptionId,
        status,
        plan_tier: planTier,
        role,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        canceled_at: canceledAt ?? null,
        updated_at: now,
      },
      { onConflict: "provider,provider_subscription_id" }
    )
    .select(
      "id,user_id,provider,provider_subscription_id,status,plan_tier,role,current_period_start,current_period_end,canceled_at"
    )
    .maybeSingle();
  if (error) return null;
  return (data as SubscriptionRow | null) ?? null;
}

export async function issueSubscriptionCreditsIfNeeded({
  adminClient,
  subscriptionId,
  userId,
  planTier,
  periodStart,
  periodEnd,
  subscriptionsEnabled,
}: {
  adminClient: SupabaseClient;
  subscriptionId: string;
  userId: string;
  planTier: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  subscriptionsEnabled?: boolean;
}): Promise<{ issued: boolean; reason?: string }> {
  if (!subscriptionId || !userId) return { issued: false, reason: "missing_subscription" };
  if (!planTier) return { issued: false, reason: "missing_plan" };
  if (!periodStart) return { issued: false, reason: "missing_period" };

  const enabled =
    typeof subscriptionsEnabled === "boolean"
      ? subscriptionsEnabled
      : await getAppSettingBool(APP_SETTING_KEYS.subscriptionsEnabled, false);
  if (!enabled) return { issued: false, reason: "disabled" };

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = profile?.role ?? null;
  if (!role) return { issued: false, reason: "missing_role" };

  const { data: planRow } = await adminClient
    .from("plans")
    .select("id, role, tier, listing_credits, featured_credits")
    .eq("role", role)
    .eq("tier", planTier)
    .eq("is_active", true)
    .maybeSingle();
  const plan = (planRow as PlanRow | null) ?? null;
  if (!plan) return { issued: false, reason: "plan_not_found" };

  const listingCredits = Math.max(0, plan.listing_credits ?? 0);
  const featuredCredits = Math.max(0, plan.featured_credits ?? 0);
  if (listingCredits <= 0 && featuredCredits <= 0) {
    return { issued: false, reason: "no_credits" };
  }

  const { data: existing } = await adminClient
    .from("subscription_credit_issues")
    .select("id")
    .eq("subscription_id", subscriptionId)
    .eq("period_start", periodStart)
    .maybeSingle();
  if (existing?.id) {
    return { issued: false, reason: "already_issued" };
  }

  const now = new Date().toISOString();
  const insertIssue = await adminClient
    .from("subscription_credit_issues")
    .insert({
      subscription_id: subscriptionId,
      period_start: periodStart,
      period_end: periodEnd,
      created_at: now,
    })
    .select("id")
    .maybeSingle();
  if (insertIssue.error) {
    return { issued: false, reason: "issue_insert_failed" };
  }

  if (listingCredits > 0) {
    await adminClient.from("listing_credits").insert({
      user_id: userId,
      source: "subscription",
      credits_total: listingCredits,
      credits_used: 0,
      expires_at: periodEnd,
      created_at: now,
      updated_at: now,
    });
  }

  if (featuredCredits > 0) {
    await adminClient.from("featured_credits").insert({
      user_id: userId,
      source: "subscription",
      credits_total: featuredCredits,
      credits_used: 0,
      expires_at: periodEnd,
      created_at: now,
      updated_at: now,
    });
  }

  return { issued: true };
}
