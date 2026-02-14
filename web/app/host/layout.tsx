export const dynamic = "force-dynamic";

import { getProfile, getSession } from "@/lib/auth";
import { formatRoleLabel, normalizeRole } from "@/lib/roles";
import { canManageListings, getHostNavItems, shouldShowSavedSearchNav } from "@/lib/role-access";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ActingAsSelector } from "@/components/dashboard/ActingAsSelector";
import { LegalAcceptanceGate } from "@/components/legal/LegalAcceptanceGate";
import { getLegalAcceptanceStatus } from "@/lib/legal/acceptance.server";
import { resolveJurisdiction } from "@/lib/legal/jurisdiction.server";
import { listThreadsForUser } from "@/lib/messaging/threads";
import { isAgentNetworkDiscoveryEnabled } from "@/lib/agents/agent-network";
import { getAgentDashboardNavItems, type DashboardNavItem } from "@/lib/dashboard/nav";
import { DashboardNavPills } from "@/components/dashboard/DashboardNavPills";

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
      logAuthRedirect("/host");
      redirect("/auth/login?reason=auth");
    }
    profile = await getProfile();
    const normalizedRole = normalizeRole(profile?.role);
    if (!normalizedRole) {
      redirect("/onboarding");
    }
  }

  const normalizedRole = normalizeRole(profile?.role);
  if (normalizedRole === "tenant") {
    redirect("/tenant/home");
  }
  if (normalizedRole === "admin") {
    redirect("/admin/support");
  }

  const showMyProperties = canManageListings(normalizedRole);
  const showSavedSearches = shouldShowSavedSearchNav();
  const isAgent = normalizedRole === "agent";
  let requireLegalAcceptance = false;
  let unreadMessages = 0;
  let supabase = null as Awaited<ReturnType<typeof createServerSupabaseClient>> | null;
  if (supabaseReady && profile?.id && normalizedRole) {
    try {
      supabase = await createServerSupabaseClient();
      const jurisdiction = await resolveJurisdiction({
        profile,
        userId: profile.id,
        supabase,
      });
      const acceptance = await getLegalAcceptanceStatus({
        userId: profile.id,
        role: normalizedRole,
        jurisdiction,
        supabase,
      });
      requireLegalAcceptance = !acceptance.isComplete;
    } catch {
      // ignore acceptance errors to avoid blocking hosts on transient failures
    }
  }

  if (requireLegalAcceptance) {
    return <LegalAcceptanceGate />;
  }

  if (!requireLegalAcceptance && supabaseReady && profile?.id) {
    try {
      if (!supabase) {
        supabase = await createServerSupabaseClient();
      }
      const { threads } = await listThreadsForUser({
        client: supabase,
        userId: profile.id,
        role: normalizedRole,
      });
      unreadMessages = threads.reduce((sum, thread) => sum + (thread.unread_count ?? 0), 0);
    } catch {
      unreadMessages = 0;
    }
  }

  const roleLabel = formatRoleLabel(normalizedRole);
  const workspaceTitle = `${profile?.full_name || "Your"} workspace`;
  const workspaceCopy = `Role: ${roleLabel} - Manage listings, messages, and viewings.`;
  const profileIncomplete =
    normalizedRole === "landlord" || normalizedRole === "agent"
      ? !profile?.phone || !profile?.preferred_contact
      : false;
  const agentNetworkEnabled = isAgent ? await isAgentNetworkDiscoveryEnabled() : false;
  const navItems: DashboardNavItem[] = isAgent
    ? getAgentDashboardNavItems({
        showMyProperties,
        showSavedSearches,
        showAgentNetwork: agentNetworkEnabled,
      })
    : getHostNavItems(normalizedRole).map((item) => ({
        key: item.href,
        label: item.label,
        href: item.href,
        show: item.visible,
      }));

  return (
    <div className="mx-auto flex min-w-0 max-w-6xl flex-col gap-6 px-4">
      <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
              Dashboard
            </p>
            <p className="text-xl font-semibold">{workspaceTitle}</p>
            <p className="text-sm text-slate-200">{workspaceCopy}</p>
          </div>
          <DashboardNavPills items={navItems} unreadMessages={unreadMessages} />
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
