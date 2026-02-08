export const dynamic = "force-dynamic";

import Link from "next/link";
import { getProfile, getSession } from "@/lib/auth";
import { formatRoleLabel, normalizeRole } from "@/lib/roles";
import { canManageListings, shouldShowSavedSearchNav } from "@/lib/role-access";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ActingAsSelector } from "@/components/dashboard/ActingAsSelector";
import { listThreadsForUser } from "@/lib/messaging/threads";
import { LegalAcceptanceGate } from "@/components/legal/LegalAcceptanceGate";
import { getLegalAcceptanceStatus } from "@/lib/legal/acceptance.server";
import { resolveJurisdiction } from "@/lib/legal/jurisdiction.server";
import { resolveAgentOnboardingProgress } from "@/lib/agents/agent-onboarding.server";
import AgentOnboardingChecklist from "@/components/agents/AgentOnboardingChecklist";

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
  const showSavedSearches = shouldShowSavedSearchNav();
  const isTenant = normalizedRole === "tenant";
  const isAgent = normalizedRole === "agent";
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
  let unreadMessages = 0;
  let requireLegalAcceptance = false;
  let supabase = null as Awaited<ReturnType<typeof createServerSupabaseClient>> | null;
  let agentOnboarding = null as Awaited<ReturnType<typeof resolveAgentOnboardingProgress>> | null;

  if (supabaseReady && profile?.id) {
    try {
      supabase = await createServerSupabaseClient();
      if (normalizedRole) {
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
      }

      if (!requireLegalAcceptance) {
        const { threads } = await listThreadsForUser({
          client: supabase,
          userId: profile.id,
          role: normalizedRole,
        });
        unreadMessages = threads.reduce((sum, thread) => sum + (thread.unread_count ?? 0), 0);
      }
    } catch {
      unreadMessages = 0;
    }
  }

  if (requireLegalAcceptance) {
    return <LegalAcceptanceGate />;
  }

  if (supabaseReady && profile?.id && isAgent) {
    if (!supabase) {
      supabase = await createServerSupabaseClient();
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.propatyhub.com";
    agentOnboarding = await resolveAgentOnboardingProgress({
      supabase,
      userId: profile.id,
      agentSlug: profile?.agent_slug ?? null,
      siteUrl,
    });
  }

  type NavItem = {
    key: string;
    label: string;
    href: string;
    show: boolean;
    showUnread?: boolean;
  };

  const defaultNavItems: NavItem[] = [
    { key: "listings", label: "My listings", href: "/host", show: showMyProperties },
    { key: "analytics", label: "Analytics", href: "/dashboard/analytics", show: showMyProperties },
    { key: "billing", label: "Billing", href: "/dashboard/billing", show: !isTenant },
    {
      key: "saved-searches",
      label: "Saved searches",
      href: "/dashboard/saved-searches",
      show: showSavedSearches,
    },
    { key: "messages", label: "Messages", href: "/dashboard/messages", show: true, showUnread: true },
    { key: "leads", label: "Leads", href: "/dashboard/leads", show: showMyProperties },
    {
      key: "verification",
      label: "Verification",
      href: "/dashboard/settings/verification",
      show: !isTenant,
    },
    { key: "viewings", label: "Viewings", href: "/dashboard/viewings", show: true },
  ];

  const agentNavItems: NavItem[] = [
    { key: "listings", label: "My listings", href: "/host", show: showMyProperties },
    { key: "client-pages", label: "Client pages", href: "/profile/clients", show: true },
    { key: "leads", label: "Leads", href: "/dashboard/leads", show: showMyProperties },
    { key: "messages", label: "Messages", href: "/dashboard/messages", show: true, showUnread: true },
    { key: "viewings", label: "Viewings", href: "/dashboard/viewings", show: true },
    { key: "analytics", label: "Analytics", href: "/dashboard/analytics", show: showMyProperties },
    { key: "billing", label: "Billing", href: "/dashboard/billing", show: !isTenant },
    {
      key: "saved-searches",
      label: "Saved searches",
      href: "/dashboard/saved-searches",
      show: showSavedSearches,
    },
    {
      key: "verification",
      label: "Verification",
      href: "/dashboard/settings/verification",
      show: !isTenant,
    },
  ];

  const navItems = isAgent ? agentNavItems : defaultNavItems;

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
            {navItems
              .filter((item) => item.show)
              .map((item) => (
                <Link key={item.key} href={item.href} className="rounded-full bg-white/10 px-3 py-1">
                  {item.showUnread ? (
                    <span className="inline-flex items-center gap-2">
                      {item.label}
                      {unreadMessages > 0 && (
                        <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-slate-900">
                          {unreadMessages}
                        </span>
                      )}
                    </span>
                  ) : (
                    item.label
                  )}
                </Link>
              ))}
          </div>
        </div>
      </div>
      {agentOnboarding && !agentOnboarding.completedAt && (
        <AgentOnboardingChecklist progress={agentOnboarding} />
      )}
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
