import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { parseReferralSettingsRows } from "@/lib/referrals/settings";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import AdminReferralSimulator from "@/components/admin/AdminReferralSimulator";

export const dynamic = "force-dynamic";

type AppSettingRow = {
  key: string;
  value: unknown;
};

async function requireAdmin() {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/admin/referrals/simulator&reason=auth");
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/referrals/simulator&reason=auth");

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

export default async function AdminReferralSimulatorPage() {
  const { supabase } = await requireAdmin();

  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [
      APP_SETTING_KEYS.referralsEnabled,
      APP_SETTING_KEYS.referralMaxDepth,
      APP_SETTING_KEYS.referralEnabledLevels,
      APP_SETTING_KEYS.referralRewardRules,
      APP_SETTING_KEYS.referralTierThresholds,
      APP_SETTING_KEYS.referralCaps,
    ]);

  const settings = parseReferralSettingsRows((data as AppSettingRow[] | null) ?? []);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
        <p className="text-xl font-semibold">Referral cost simulator</p>
        <p className="text-sm text-slate-200">
          Explore potential monthly referral reward impact under configurable assumptions.
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <Link href="/admin/settings/referrals" className="underline underline-offset-4">
            Back to referral settings
          </Link>
          <Link href="/admin/settings" className="underline underline-offset-4">
            Settings
          </Link>
        </div>
      </div>

      <AdminReferralSimulator
        maxDepth={settings.maxDepth}
        enabledLevels={settings.enabledLevels}
        rewardRules={settings.rewardRules}
      />
    </div>
  );
}
