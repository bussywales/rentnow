export const dynamic = "force-dynamic";

import Link from "next/link";
import { getProfile, getSession } from "@/lib/auth";
import { formatRoleLabel, normalizeRole } from "@/lib/roles";
import { canManageListings, shouldShowSavedSearchNav } from "@/lib/role-access";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ActingAsSelector } from "@/components/dashboard/ActingAsSelector";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabaseReady = hasServerSupabaseEnv();
  let profile = null;
  if (supabaseReady) {
    const session = await getSession();
    if (!session) {
      logAuthRedirect("/dashboard");
      redirect("/auth/login?reason=auth");
    }
    profile = await getProfile();
    const normalizedRole = normalizeRole(profile?.role);
    if (!normalizedRole) {
      redirect("/onboarding");
    }
  }

  const normalizedRole = normalizeRole(profile?.role);
  const roleLabel = formatRoleLabel(normalizedRole);
  const showMyProperties = canManageListings(normalizedRole);
  const showSavedSearches = shouldShowSavedSearchNav(normalizedRole);
  const isTenant = normalizedRole === "tenant";
  if (normalizedRole === "admin") {
    redirect("/admin/support");
  }
  const workspaceTitle = isTenant
    ? "Tenant workspace"
    : `${profile?.full_name || "Your"} workspace`;
  const workspaceCopy = isTenant
    ? "Role: Tenant - Manage saved searches, messages, and viewings."
    : `Role: ${roleLabel} - Manage listings, messages, and viewings.`;
  const profileIncomplete =
    normalizedRole === "landlord" || normalizedRole === "agent"
      ? !profile?.phone || !profile?.preferred_contact
      : false;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
              Dashboard
            </p>
            <p className="text-xl font-semibold">{workspaceTitle}</p>
            <p className="text-sm text-slate-200">{workspaceCopy}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {showMyProperties && (
              <Link href="/host" className="rounded-full bg-white/10 px-3 py-1">
                My properties
              </Link>
            )}
            {showMyProperties && (
              <Link href="/dashboard/analytics" className="rounded-full bg-white/10 px-3 py-1">
                Analytics
              </Link>
            )}
            {!isTenant && (
              <Link href="/dashboard/billing" className="rounded-full bg-white/10 px-3 py-1">
                Billing
              </Link>
            )}
            {showSavedSearches && (
              <Link
                href="/dashboard/saved-searches"
                className="rounded-full bg-white/10 px-3 py-1"
              >
                Saved searches
              </Link>
            )}
            <Link href="/dashboard/messages" className="rounded-full bg-white/10 px-3 py-1">
              Messages
            </Link>
            <Link href="/dashboard/viewings" className="rounded-full bg-white/10 px-3 py-1">
              Viewings
            </Link>
          </div>
        </div>
      </div>
      {profileIncomplete && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Complete your profile to get listings approved faster.</p>
          <p className="mt-1 text-amber-800">
            Add a phone number and preferred contact so tenants can reach you quickly.
          </p>
          <Link
            href={`/onboarding/${normalizedRole}`}
            className="mt-2 inline-flex text-sm font-semibold text-amber-900 underline-offset-4 hover:underline"
          >
            Finish setup
          </Link>
        </div>
      )}
      {normalizedRole === "agent" && <ActingAsSelector />}
      {children}
    </div>
  );
}
