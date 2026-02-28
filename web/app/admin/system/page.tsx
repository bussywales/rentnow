import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { RoleChecklistPanel } from "@/components/checklists/RoleChecklistPanel";
import { NextBestActionsPanel } from "@/components/checklists/NextBestActionsPanel";
import { HelpDrawerTrigger } from "@/components/help/HelpDrawerTrigger";
import { AdminFxActions } from "@/components/admin/AdminFxActions";
import {
  buildSystemHealthSettingsSnapshot,
  getSystemHealthEnvStatus,
  SYSTEM_HEALTH_SETTING_KEYS,
  type SystemHealthSettingsSnapshot,
} from "@/lib/admin/system-health";
import { BRAND } from "@/lib/brand";
import {
  loadAdminChecklist,
  loadAdminVerificationRollup,
  type AdminVerificationRollup,
} from "@/lib/checklists/role-checklists.server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export const dynamic = "force-dynamic";

const PWA_MANIFEST_PATH = "/manifest.webmanifest";
const PWA_START_URL = "/?source=pwa";
const PWA_SCOPE = "/";
const PWA_SW_PATH = "/sw.js";
const PWA_ICON_PATHS = [
  "/icons/app-icon-192.png",
  "/icons/app-icon-512.png",
  "/icons/app-icon-512-maskable.png",
  "/icons/app-icon-1024.png",
  "/apple-touch-icon.png",
];

function statusPill(enabled: boolean) {
  const tone = enabled
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-rose-200 bg-rose-50 text-rose-700";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>
      {enabled ? "Present" : "Missing"}
    </span>
  );
}

function boolPill(enabled: boolean) {
  const tone = enabled
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

async function loadAdminSystemHealth() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/admin/system&reason=auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/forbidden?reason=role");

  const client = hasServiceRoleEnv()
    ? (createServiceRoleClient() as unknown as UntypedAdminClient)
    : (supabase as unknown as UntypedAdminClient);

  const { data } = await client
    .from("app_settings")
    .select("key, value")
    .in("key", [...SYSTEM_HEALTH_SETTING_KEYS]);

  const settings = buildSystemHealthSettingsSnapshot(
    (((data as Array<{ key: string; value: unknown }> | null) ?? []) as Array<{
      key: string;
      value: unknown;
    }>)
  );
  const env = getSystemHealthEnvStatus();
  const [opsChecklist, verificationRollup] = await Promise.all([
    loadAdminChecklist({ supabase: client as unknown as SupabaseClient }),
    loadAdminVerificationRollup({ supabase: client as unknown as SupabaseClient }),
  ]);

  return {
    settings,
    env,
    serverTimeUtc: new Date().toISOString(),
    opsChecklist,
    verificationRollup,
  };
}

function SettingRow(props: {
  label: string;
  value: string | boolean;
  type?: "bool";
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="text-sm text-slate-600">{props.label}</dt>
      <dd className="text-sm font-medium text-slate-900">
        {props.type === "bool" ? boolPill(Boolean(props.value)) : String(props.value)}
      </dd>
    </div>
  );
}

function SettingsSnapshot(props: { settings: SystemHealthSettingsSnapshot }) {
  const s = props.settings;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Alerts + Featured</h2>
        <dl className="mt-2 divide-y divide-slate-100">
          <SettingRow label="alerts_email_enabled" value={s.alertsEmailEnabled} type="bool" />
          <SettingRow
            label="alerts_kill_switch_enabled"
            value={s.alertsKillSwitchEnabled}
            type="bool"
          />
          <SettingRow label="featured_requests_enabled" value={s.featuredRequestsEnabled} type="bool" />
          <SettingRow label="featured_listings_enabled" value={s.featuredListingsEnabled} type="bool" />
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Verification</h2>
        <dl className="mt-2 divide-y divide-slate-100">
          <SettingRow label="verification_require_email" value={s.verificationRequireEmail} type="bool" />
          <SettingRow label="verification_require_phone" value={s.verificationRequirePhone} type="bool" />
          <SettingRow label="verification_require_bank" value={s.verificationRequireBank} type="bool" />
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-2">
        <h2 className="text-sm font-semibold text-slate-900">Market defaults</h2>
        <dl className="mt-2 grid gap-2 divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0 md:gap-3">
          <SettingRow label="default_market_country" value={s.defaultMarketCountry} />
          <SettingRow label="default_market_currency" value={s.defaultMarketCurrency} />
          <SettingRow label="market_auto_detect_enabled" value={s.marketAutoDetectEnabled} type="bool" />
          <SettingRow label="market_selector_enabled" value={s.marketSelectorEnabled} type="bool" />
        </dl>
      </section>
    </div>
  );
}

function VerificationCountsCard({
  counts,
}: {
  counts: AdminVerificationRollup;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Verification requirements</h2>
        <Link href="/admin/settings" className="text-xs font-semibold text-sky-700 underline underline-offset-4">
          Manage settings
        </Link>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Rough counts for host and agent profiles still missing each marker.
      </p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Missing email</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900">{counts.missingEmail ?? "—"}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Missing phone</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900">{counts.missingPhone ?? "—"}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Missing bank</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-900">{counts.missingBank ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}

export default async function AdminSystemPage() {
  const { settings, env, serverTimeUtc, opsChecklist, verificationRollup } = await loadAdminSystemHealth();
  const shortCommit = env.commitSha ? env.commitSha.slice(0, 8) : "unknown";
  const manifestUrl = new URL(PWA_MANIFEST_PATH, BRAND.siteUrl).href;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <section className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Admin</p>
            <h1 className="text-2xl font-semibold">System health</h1>
          </div>
          <HelpDrawerTrigger
            label="Need help?"
            className="border-white/30 bg-white/10 text-white hover:bg-white/20"
            testId="admin-help-trigger"
          />
        </div>
        <p className="mt-1 text-sm text-slate-200">
          Lightweight go-live visibility for environment readiness and key launch toggles.
        </p>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-slate-300">Server time (UTC): </span>
            <span className="font-medium">{serverTimeUtc}</span>
          </p>
          <p>
            <span className="text-slate-300">Build commit: </span>
            <span className="font-medium">{shortCommit}</span>
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Environment indicators</h2>
        <dl className="mt-2 divide-y divide-slate-100">
          <div className="flex items-center justify-between gap-3 py-2">
            <dt className="text-sm text-slate-600">RESEND_API_KEY</dt>
            <dd>{statusPill(env.resendApiKeyPresent)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2">
            <dt className="text-sm text-slate-600">CRON_SECRET</dt>
            <dd>{statusPill(env.cronSecretPresent)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2">
            <dt className="text-sm text-slate-600">PAYSTACK_SECRET_KEY</dt>
            <dd>{statusPill(env.paystackSecretKeyPresent)}</dd>
          </div>
        </dl>
      </section>

      <AdminFxActions />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">PWA installability diagnostics</h2>
        <p className="mt-1 text-xs text-slate-500">
          Quick reference for Android install troubleshooting, including Samsung Internet checks.
        </p>
        <dl className="mt-3 space-y-2 text-sm text-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <dt className="font-medium text-slate-900">Manifest URL</dt>
            <dd>
              <a href={manifestUrl} className="text-sky-700 underline underline-offset-2">
                {manifestUrl}
              </a>
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <dt className="font-medium text-slate-900">start_url + scope</dt>
            <dd>
              <code>{PWA_START_URL}</code>
              <span className="mx-2 text-slate-400">|</span>
              <code>{PWA_SCOPE}</code>
            </dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <dt className="font-medium text-slate-900">Service worker</dt>
            <dd>
              <code>{PWA_SW_PATH}</code>
              <span className="mx-2 text-slate-400">|</span>
              <code>scope {PWA_SCOPE}</code>
            </dd>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <dt className="font-medium text-slate-900">Icon URLs</dt>
            <dd className="mt-1 flex flex-wrap gap-2 text-xs">
              {PWA_ICON_PATHS.map((iconPath) => {
                const iconUrl = new URL(iconPath, BRAND.siteUrl).href;
                return (
                  <a
                    key={iconPath}
                    href={iconUrl}
                    className="rounded-full border border-slate-300 px-2 py-1 text-slate-700 hover:border-sky-300 hover:text-sky-700"
                  >
                    {iconPath}
                  </a>
                );
              })}
            </dd>
          </div>
        </dl>
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p className="font-medium text-slate-900">How to verify install</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            <li>Open Chrome/Edge DevTools → Application → Manifest and check installability warnings.</li>
            <li>Verify <code>{PWA_MANIFEST_PATH}</code> and each icon URL returns 200 with image/png.</li>
            <li>Open DevTools → Application → Service Workers and confirm {PWA_SW_PATH} controls {PWA_SCOPE}.</li>
          </ol>
        </div>
      </section>

      <SettingsSnapshot settings={settings} />

      <VerificationCountsCard counts={verificationRollup} />

      {Array.isArray(opsChecklist) && opsChecklist.length > 0 ? (
        <NextBestActionsPanel role="admin" items={opsChecklist} />
      ) : null}

      {Array.isArray(opsChecklist) && opsChecklist.length > 0 ? (
        <RoleChecklistPanel
          title="Admin getting started checklist"
          subtitle="Daily launch-safety checks for approvals, featured queues, alerts, and publishing."
          items={opsChecklist}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Quick links</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href="/admin/alerts" className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700">
            Alerts ops
          </Link>
          <Link href="/admin/payments" className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700">
            Payments ops
          </Link>
          <Link href="/admin/shortlets" className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700">
            Shortlet bookings
          </Link>
          <Link href="/admin/shortlets/payouts" className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700">
            Shortlet payouts
          </Link>
          <Link href="/admin/settings" className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700">
            Settings
          </Link>
          <Link href="/admin/featured/requests" className="rounded-lg border border-slate-300 px-3 py-2 text-slate-700">
            Featured requests
          </Link>
        </div>
      </section>
    </div>
  );
}
