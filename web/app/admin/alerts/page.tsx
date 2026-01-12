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

export const dynamic = "force-dynamic";

type AlertDiagnostics = {
  ready: boolean;
  alerts: AdminAlert[];
  error: string | null;
  configured: boolean;
  role: string | null;
  userId: string | null;
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

  if (!hasServiceRoleEnv()) {
    return {
      ready: false,
      alerts: [],
      error: "Service role key missing; alerts unavailable.",
      configured: pushConfig.configured,
      role: profile?.role ?? null,
      userId: user.id,
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
          Derived alerts for push, messaging throttling, and listing data quality. Read-only.
        </p>
      </div>

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
