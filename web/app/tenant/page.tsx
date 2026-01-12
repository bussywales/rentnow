import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveServerRole } from "@/lib/auth/role";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TenantWorkspace() {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Tenant workspace</h1>
        <p className="text-sm text-slate-600">
          Supabase is not configured, so tenant tools are unavailable.
        </p>
      </div>
    );
  }

  const { user, role } = await resolveServerRole();

  if (!user) {
    redirect("/auth/login?reason=auth");
  }

  if (!role) {
    redirect("/onboarding");
  }

  if (role !== "tenant") {
    redirect(role === "admin" ? "/admin/support" : "/host");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
          Dashboard
        </p>
        <h1 className="text-xl font-semibold">Tenant workspace</h1>
        <p className="text-sm text-slate-200">
          Manage saved searches, messages, and viewing requests.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Saved searches</h2>
          <p className="mt-1 text-sm text-slate-600">
            Track listings and enable alerts for new matches.
          </p>
          <Link
            href="/dashboard/saved-searches"
            className="mt-3 inline-flex text-sm font-semibold text-slate-700 underline-offset-4 hover:underline"
          >
            Open saved searches
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Messages</h2>
          <p className="mt-1 text-sm text-slate-600">
            Follow up with hosts and keep conversations in one place.
          </p>
          <Link
            href="/dashboard/messages"
            className="mt-3 inline-flex text-sm font-semibold text-slate-700 underline-offset-4 hover:underline"
          >
            View messages
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Viewings</h2>
          <p className="mt-1 text-sm text-slate-600">
            Manage viewing requests and upcoming appointments.
          </p>
          <Link
            href="/dashboard/viewings"
            className="mt-3 inline-flex text-sm font-semibold text-slate-700 underline-offset-4 hover:underline"
          >
            Review viewings
          </Link>
        </div>
      </div>
    </div>
  );
}
