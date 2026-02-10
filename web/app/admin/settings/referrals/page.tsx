import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { parseReferralSettingsRows } from "@/lib/referrals/settings";
import { parseAppSettingInt } from "@/lib/settings/app-settings";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { DEFAULT_PAYG_LISTING_FEE_AMOUNT } from "@/lib/billing/payg";
import AdminSettingsReferrals from "@/components/admin/AdminSettingsReferrals";
import AdminReferralJurisdictions from "@/components/admin/AdminReferralJurisdictions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type AppSettingRow = {
  key: string;
  value: unknown;
};

async function requireAdmin() {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/admin/settings/referrals&reason=auth");
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/settings/referrals&reason=auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  return { supabase };
}

export default async function AdminReferralSettingsPage() {
  const { supabase } = await requireAdmin();

  const [settingsRows, referralCount, rewardsResult, policyRows, paygRow, milestoneRows] =
    await Promise.all([
    supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        APP_SETTING_KEYS.referralsEnabled,
        APP_SETTING_KEYS.referralMaxDepth,
        APP_SETTING_KEYS.referralEnabledLevels,
        APP_SETTING_KEYS.referralRewardRules,
        APP_SETTING_KEYS.referralsTierThresholds,
        APP_SETTING_KEYS.referralTierThresholds,
        APP_SETTING_KEYS.referralsMilestonesEnabled,
        APP_SETTING_KEYS.referralsLeaderboardEnabled,
        APP_SETTING_KEYS.referralsLeaderboardPublicVisible,
        APP_SETTING_KEYS.referralsLeaderboardMonthlyEnabled,
        APP_SETTING_KEYS.referralsLeaderboardAllTimeEnabled,
        APP_SETTING_KEYS.referralsLeaderboardInitialsOnly,
        APP_SETTING_KEYS.referralsLeaderboardScope,
        APP_SETTING_KEYS.enableShareTracking,
        APP_SETTING_KEYS.attributionWindowDays,
        APP_SETTING_KEYS.storeIpHash,
        APP_SETTING_KEYS.referralCaps,
      ]),
    supabase.from("referrals").select("id", { count: "exact", head: true }),
    supabase.from("referral_rewards").select("id, reward_amount"),
    supabase
      .from("referral_jurisdiction_policies")
      .select(
        "id, country_code, payouts_enabled, conversion_enabled, credit_to_cash_rate, cashout_rate_mode, cashout_rate_amount_minor, cashout_rate_percent, cashout_eligible_sources, currency, min_cashout_credits, monthly_cashout_cap_amount, requires_manual_approval, updated_at"
      )
      .order("country_code", { ascending: true }),
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", APP_SETTING_KEYS.paygListingFeeAmount)
      .maybeSingle<{ value: unknown }>(),
    supabase
      .from("referral_milestones")
      .select("id, name, active_referrals_threshold, bonus_credits, is_enabled, created_at")
      .order("active_referrals_threshold", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const settings = parseReferralSettingsRows((settingsRows.data as AppSettingRow[] | null) ?? []);
  const paygListingFeeAmount = Math.max(
    0,
    parseAppSettingInt(paygRow.data?.value, DEFAULT_PAYG_LISTING_FEE_AMOUNT)
  );
  const rewardRows =
    ((rewardsResult.data as Array<{ id: string; reward_amount: number | null }> | null) ?? []);

  const totalCreditsEarned = rewardRows.reduce(
    (sum, row) => sum + Math.max(0, Number(row.reward_amount || 0)),
    0
  );
  const referralsSettingsKey = JSON.stringify({
    enabled: settings.enabled,
    maxDepth: settings.maxDepth,
    enabledLevels: settings.enabledLevels,
    rewardRules: settings.rewardRules,
    tierThresholds: settings.tierThresholds,
    milestonesEnabled: settings.milestonesEnabled,
    leaderboard: settings.leaderboard,
    shareTracking: settings.shareTracking,
    caps: settings.caps,
    milestones:
      ((milestoneRows.data as Array<{
        id: string;
        name: string;
        active_referrals_threshold: number;
        bonus_credits: number;
        is_enabled: boolean;
        created_at: string;
      }> | null) ?? []),
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Referral program settings</p>
        <p className="text-sm text-slate-200">
          Configure reward depth, per-level rules, tiers, and kill switches.
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <Link href="/admin/settings" className="underline underline-offset-4">
            Back to Settings
          </Link>
          <Link href="/admin/referrals/simulator" className="underline underline-offset-4">
            Open simulator
          </Link>
          <Link href="/admin/referrals/payouts" className="underline underline-offset-4">
            Open payouts queue
          </Link>
          <Link href="/admin/referrals/attribution" className="underline underline-offset-4">
            Open attribution analytics
          </Link>
          <Link href="/help/referrals" className="underline underline-offset-4">
            Referral FAQ
          </Link>
          <Link href="/dashboard/referrals/leaderboard" className="underline underline-offset-4">
            Leaderboard preview
          </Link>
          <Link href="/admin" className="underline underline-offset-4">
            Admin home
          </Link>
        </div>
      </div>

      <AdminSettingsReferrals
        key={referralsSettingsKey}
        enabled={settings.enabled}
        maxDepth={settings.maxDepth}
        enabledLevels={settings.enabledLevels}
        rewardRules={settings.rewardRules}
        tierThresholds={settings.tierThresholds}
        milestonesEnabled={settings.milestonesEnabled}
        leaderboard={settings.leaderboard}
        shareTracking={settings.shareTracking}
        milestones={
          ((milestoneRows.data as Array<{
            id: string;
            name: string;
            active_referrals_threshold: number;
            bonus_credits: number;
            is_enabled: boolean;
            created_at: string;
          }> | null) ?? [])
        }
        caps={settings.caps}
        analytics={{
          totalReferred: referralCount.count ?? 0,
          totalRewardsIssued: rewardRows.length,
          totalCreditsEarned,
        }}
      />
      <AdminReferralJurisdictions
        initialPolicies={
          ((policyRows.data as Array<{
            id: string;
            country_code: string;
            payouts_enabled: boolean;
            conversion_enabled: boolean;
            credit_to_cash_rate: number;
            cashout_rate_mode: "fixed" | "percent_of_payg";
            cashout_rate_amount_minor: number | null;
            cashout_rate_percent: number | null;
            cashout_eligible_sources: Array<
              "payg_listing_fee_paid" | "featured_purchase_paid" | "subscription_paid"
            >;
            currency: string;
            min_cashout_credits: number;
            monthly_cashout_cap_amount: number;
            requires_manual_approval: boolean;
            updated_at: string;
          }> | null) ?? [])
        }
        paygListingFeeAmount={paygListingFeeAmount}
      />
    </div>
  );
}
