import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { parseReferralSettingsRows } from "@/lib/referrals/settings";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import AdminSettingsReferrals from "@/components/admin/AdminSettingsReferrals";

export const dynamic = "force-dynamic";

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

  const [settingsRows, referralCount, rewardsResult] = await Promise.all([
    supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        APP_SETTING_KEYS.referralsEnabled,
        APP_SETTING_KEYS.referralMaxDepth,
        APP_SETTING_KEYS.referralEnabledLevels,
        APP_SETTING_KEYS.referralRewardRules,
        APP_SETTING_KEYS.referralTierThresholds,
        APP_SETTING_KEYS.referralCaps,
      ]),
    supabase.from("referrals").select("id", { count: "exact", head: true }),
    supabase.from("referral_rewards").select("id, reward_amount"),
  ]);

  const settings = parseReferralSettingsRows((settingsRows.data as AppSettingRow[] | null) ?? []);
  const rewardRows =
    ((rewardsResult.data as Array<{ id: string; reward_amount: number | null }> | null) ?? []);

  const totalCreditsEarned = rewardRows.reduce(
    (sum, row) => sum + Math.max(0, Number(row.reward_amount || 0)),
    0
  );

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
          <Link href="/admin" className="underline underline-offset-4">
            Admin home
          </Link>
        </div>
      </div>

      <AdminSettingsReferrals
        enabled={settings.enabled}
        maxDepth={settings.maxDepth}
        enabledLevels={settings.enabledLevels}
        rewardRules={settings.rewardRules}
        tierThresholds={settings.tierThresholds}
        caps={settings.caps}
        analytics={{
          totalReferred: referralCount.count ?? 0,
          totalRewardsIssued: rewardRows.length,
          totalCreditsEarned,
        }}
      />
    </div>
  );
}
