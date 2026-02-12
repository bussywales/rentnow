import Link from "next/link";
import { redirect } from "next/navigation";
import {
  buildAdminAlerts,
  type AdminAlert,
} from "@/lib/admin/alerting";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getPushConfig } from "@/lib/push/server";
import { formatRoleLabel } from "@/lib/roles";
import { getAlertsLastRunStatus, getAppSettingBool } from "@/lib/settings/app-settings.server";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { AdminAlertsOpsActions } from "@/components/admin/AdminAlertsOpsActions";

export const dynamic = "force-dynamic";

type AlertDiagnostics = {
  ready: boolean;
  alerts: AdminAlert[];
  error: string | null;
  configured: boolean;
  role: string | null;
  userId: string | null;
  alertsEmailEnabled: boolean;
  alertsKillSwitchEnabled: boolean;
  envAlertsOverrideEnabled: boolean;
  resendConfigured: boolean;
  cronSecretConfigured: boolean;
  lastRun: {
    ran_at_utc: string | null;
    mode: "cron" | "admin";
    users_processed: number;
    digests_sent: number;
    searches_included: number;
    failed_users: number;
    disabled_reason: null | "kill_switch" | "feature_flag_off";
  };
};

const severityStyles: Record<AdminAlert["severity"], string> = {
  info: "bg-slate-100 text-slate-700",
  warn: "bg-amber-100 text-amber-800",
  critical: "bg-rose-100 text-rose-800",
};

async function getAlertDiagnostics(): Promise<AlertDiagnostics> {
  if (!hasServerSupabaseEnv()) {
    return {
      ready: false,
      alerts: [],
      error: "Supabase env not configured.",
      configured: false,
      role: null,
      userId: null,
      alertsEmailEnabled: false,
      alertsKillSwitchEnabled: false,
      envAlertsOverrideEnabled: false,
      resendConfigured: false,
      cronSecretConfigured: false,
      lastRun: await getAlertsLastRunStatus(),
    };
  }

  const { supabase, user } = await getServerAuthUser();

  if (!user) {
    redirect("/auth/required?redirect=/admin/alerts&reason=auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  const pushConfig = getPushConfig();
  const [alertsEmailEnabled, alertsKillSwitchEnabled, lastRun] = await Promise.all([
    getAppSettingBool(APP_SETTING_KEYS.alertsEmailEnabled, false),
    getAppSettingBool(APP_SETTING_KEYS.alertsKillSwitchEnabled, false),
    getAlertsLastRunStatus(),
  ]);
  const envAlertsOverrideEnabled = /^(1|true|yes|on)$/i.test(
    String(process.env.ALERTS_EMAIL_ENABLED ?? "")
  );
  const resendConfigured = Boolean(process.env.RESEND_API_KEY);
  const cronSecretConfigured = Boolean(process.env.CRON_SECRET);

  if (!hasServiceRoleEnv()) {
    return {
      ready: false,
      alerts: [],
      error: "Service role key missing; alerts unavailable.",
      configured: pushConfig.configured,
      role: profile?.role ?? null,
      userId: user.id,
      alertsEmailEnabled,
      alertsKillSwitchEnabled,
      envAlertsOverrideEnabled,
      resendConfigured,
      cronSecretConfigured,
      lastRun,
    };
  }

  const adminClient = createServiceRoleClient();
  const { alerts, error } = await buildAdminAlerts(adminClient, pushConfig);

  return {
    ready: true,
    alerts,
    error,
    configured: pushConfig.configured,
    role: profile?.role ?? null,
    userId: user.id,
    alertsEmailEnabled,
    alertsKillSwitchEnabled,
    envAlertsOverrideEnabled,
    resendConfigured,
    cronSecretConfigured,
    lastRun,
  };
}

export default async function AdminAlertsPage() {
  const diag = await getAlertDiagnostics();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Alerts Inbox</h1>
        <p className="text-sm text-slate-600">
          Alerts Ops for saved-search email delivery and derived admin alert signals.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Alerts status</h2>
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-3">
              <dt>Email alerts setting</dt>
              <dd className={diag.alertsEmailEnabled ? "text-emerald-700" : "text-slate-500"}>
                {diag.alertsEmailEnabled ? "On" : "Off"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Kill switch</dt>
              <dd className={diag.alertsKillSwitchEnabled ? "text-rose-700" : "text-slate-500"}>
                {diag.alertsKillSwitchEnabled ? "Enabled" : "Disabled"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Env override (`ALERTS_EMAIL_ENABLED=true`)</dt>
              <dd className={diag.envAlertsOverrideEnabled ? "text-emerald-700" : "text-slate-500"}>
                {diag.envAlertsOverrideEnabled ? "Present" : "Not set"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Resend configured</dt>
              <dd className={diag.resendConfigured ? "text-emerald-700" : "text-slate-500"}>
                {diag.resendConfigured ? "Yes" : "No"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>CRON secret configured</dt>
              <dd className={diag.cronSecretConfigured ? "text-emerald-700" : "text-slate-500"}>
                {diag.cronSecretConfigured ? "Yes" : "No"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Last run</h2>
          <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Ran at (UTC)</dt>
              <dd>{diag.lastRun.ran_at_utc ? diag.lastRun.ran_at_utc.replace("T", " ").replace("Z", "") : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Mode</dt>
              <dd className="uppercase">{diag.lastRun.mode}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Users processed</dt>
              <dd>{diag.lastRun.users_processed}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Digests sent</dt>
              <dd>{diag.lastRun.digests_sent}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Searches included</dt>
              <dd>{diag.lastRun.searches_included}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Failed users</dt>
              <dd>{diag.lastRun.failed_users}</dd>
            </div>
          </dl>
          {diag.lastRun.disabled_reason ? (
            <p className="mt-3 text-xs text-amber-700">
              Disabled reason: {diag.lastRun.disabled_reason}
            </p>
          ) : null}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Actions</h2>
        <p className="mt-1 text-sm text-slate-600">
          Trigger a run, send a test digest, or disable alerts quickly.
        </p>
        <div className="mt-3">
          <AdminAlertsOpsActions
            alertsEnabled={diag.alertsEmailEnabled}
            killSwitchEnabled={diag.alertsKillSwitchEnabled}
          />
        </div>
      </section>

      {!diag.ready && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {diag.error}
        </div>
      )}

      {diag.ready && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Alert signals</p>
              <p className="text-sm text-slate-600">
                User {diag.userId} · Role {formatRoleLabel(diag.role)}
              </p>
            </div>
            <div className="text-sm text-slate-600">
              Push configured: {diag.configured ? "Yes" : "No"}
            </div>
          </div>
          {diag.alerts.length ? (
            <ul className="mt-4 space-y-4">
              {diag.alerts.map((alert) => (
                <li key={alert.key} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${severityStyles[alert.severity]}`}>
                        {alert.severity}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{alert.title}</span>
                    </div>
                    <span className="text-xs text-slate-500">{alert.window}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{alert.summary}</p>
                  <p className="mt-2 text-sm text-slate-600">Signal: {alert.signal}</p>
                  <p className="mt-2 text-sm text-slate-600">Action: {alert.recommended_action}</p>
                  <div className="mt-2 text-xs text-slate-500">
                    Updated: {alert.last_updated_at.slice(0, 19).replace("T", " ")}
                  </div>
                  <div className="mt-2 text-sm">
                    <Link href={alert.runbook_link} className="text-sky-700 underline">
                      Runbook
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-600">No alerts triggered in the current windows.</p>
          )}
          {diag.error && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Errors: {diag.error}
            </div>
          )}
        </div>
      )}

      <div id="runbook" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Runbook</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Validate push config and subscription counts in `/admin/support`.</li>
          <li>Check messaging throttle events for sudden spikes.</li>
          <li>Review data quality samples and reach out to hosts for missing metadata.</li>
          <li>See `docs/ALERTING.md` for full verification steps.</li>
        </ul>
      </div>
    </div>
  );
}
