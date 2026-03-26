import Link from "next/link";
import { resolveServerRole } from "@/lib/auth/role";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  HELP_ROLE_LABELS,
  getHelpRoleIndexPath,
  getTopHelpDocsForRole,
  resolvePreferredHelpRole,
  type HelpRole,
} from "@/lib/help/docs";
import { PUBLIC_HELP_ROLES, getHelpVisibilityModel } from "@/lib/help/visibility";

export const dynamic = "force-dynamic";

async function resolveViewerRole() {
  if (!hasServerSupabaseEnv()) return null;
  try {
    const { user, role } = await resolveServerRole();
    if (!user) return null;
    return resolvePreferredHelpRole(role);
  } catch {
    return null;
  }
}

function roleDescription(role: HelpRole) {
  if (role === "tenant") {
    return "Browse, filters, collections, saved searches, alerts, and safety guidance.";
  }
  if (role === "landlord") {
    return "Listing quality, approvals, visibility rules, featured requests, and payments.";
  }
  if (role === "agent") {
    return "Portfolio operations, leads, messaging, featured workflows, and conversion tips.";
  }
  return "Operational playbooks for updates, featured queues, payments, alerts, and health checks.";
}

export default async function HelpCentrePage() {
  const viewerRole = await resolveViewerRole();
  const preferredRole = viewerRole ?? "tenant";
  const preferredTasks = await getTopHelpDocsForRole(preferredRole, 4);
  const visibility = getHelpVisibilityModel(viewerRole);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8" data-testid="help-landing-v2">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Help Centre</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Role-based help, built for execution</h1>
        <p className="mt-2 text-sm text-slate-600">
          Public help stays open for tenants, landlords, and agents. Internal admin and ops tutorials are kept behind the admin help route.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PUBLIC_HELP_ROLES.map((role) => (
            <Link
              key={role}
              href={getHelpRoleIndexPath(role)}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                viewerRole === role
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {HELP_ROLE_LABELS[role]}
            </Link>
          ))}
          {visibility.showInternalAdminHelp ? (
            <Link
              href="/help/admin"
              className="inline-flex items-center rounded-full border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              Admin &amp; Ops
            </Link>
          ) : null}
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Top tasks {viewerRole ? `for ${HELP_ROLE_LABELS[viewerRole]}` : "to start with"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">Jump straight into the most used workflows.</p>
          </div>
          <Link
            href={getHelpRoleIndexPath(preferredRole)}
            className="text-sm font-semibold text-sky-700 underline underline-offset-4"
          >
            Open {HELP_ROLE_LABELS[preferredRole]} help
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {preferredTasks.map((task) => (
            <Link
              key={task.slug}
              href={`${getHelpRoleIndexPath(preferredRole)}/${task.slug}`}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              {task.title}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibility.publicRoles.map((role) => (
          <Link
            key={role}
            href={getHelpRoleIndexPath(role)}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          >
            <h2 className="text-lg font-semibold text-slate-900">{HELP_ROLE_LABELS[role]} guides</h2>
            <p className="mt-1 text-sm text-slate-600">{roleDescription(role)}</p>
          </Link>
        ))}
      </section>

      {visibility.showInternalAdminHelp ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="help-internal-admin-section">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Internal help</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Admin &amp; Ops Help</h2>
          <p className="mt-1 text-sm text-slate-600">
            Internal tutorials for listings registry operations, moderation, support playbooks, payments ops, and system workflows.
          </p>
          <div className="mt-4">
            <Link
              href="/help/admin"
              className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Open internal admin help
            </Link>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href="/help/troubleshooting"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
        >
          <h2 className="text-lg font-semibold text-slate-900">Troubleshooting hub</h2>
          <p className="mt-1 text-sm text-slate-600">
            Incident checklists for login, listings, payments, and alerts operations.
          </p>
        </Link>
        <Link
          href="/help/success"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
        >
          <h2 className="text-lg font-semibold text-slate-900">Success playbooks</h2>
          <p className="mt-1 text-sm text-slate-600">
            Practical habits that improve response times, listing quality, and conversion.
          </p>
        </Link>
      </section>
    </div>
  );
}
