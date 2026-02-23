export const dynamic = "force-dynamic";

import { getProfile, getSession } from "@/lib/auth";
import { formatRoleLabel, normalizeRole } from "@/lib/roles";
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
import { countAwaitingApprovalBookings } from "@/lib/shortlet/host-bookings-inbox";
import { HostSidebar } from "@/components/host/HostSidebar";

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

  const isAgent = normalizedRole === "agent";
  let requireLegalAcceptance = false;
  let unreadMessages = 0;
  let hostAwaitingApprovalCount = 0;
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

  if (
    !requireLegalAcceptance &&
    supabaseReady &&
    profile?.id &&
    (normalizedRole === "landlord" || normalizedRole === "agent")
  ) {
    try {
      if (!supabase) {
        supabase = await createServerSupabaseClient();
      }

      const { data: shortletProperties } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", profile.id)
        .eq("listing_intent", "shortlet")
        .limit(600);

      const propertyIds = (shortletProperties ?? [])
        .map((row) => String(row.id || ""))
        .filter(Boolean);

      if (propertyIds.length) {
        const bookingsWithRespondBy = await supabase
          .from("shortlet_bookings")
          .select("id,status,respond_by,expires_at")
          .eq("status", "pending")
          .in("property_id", propertyIds)
          .order("created_at", { ascending: false })
          .limit(800);

        let bookingsError = bookingsWithRespondBy.error;
        let bookingsRows: Array<Record<string, unknown>> =
          (bookingsWithRespondBy.data as Array<Record<string, unknown>> | null) ?? [];

        if (bookingsError?.message?.toLowerCase().includes("respond_by")) {
          const bookingsWithoutRespondBy = await supabase
            .from("shortlet_bookings")
            .select("id,status,expires_at")
            .eq("status", "pending")
            .in("property_id", propertyIds)
            .order("created_at", { ascending: false })
            .limit(800);
          bookingsError = bookingsWithoutRespondBy.error;
          bookingsRows =
            (bookingsWithoutRespondBy.data as Array<Record<string, unknown>> | null) ?? [];
        }

        if (!bookingsError) {
          hostAwaitingApprovalCount = countAwaitingApprovalBookings(
            bookingsRows.map((row) => ({
              id: String(row.id || ""),
              status: String(row.status || ""),
              respond_by: typeof row.respond_by === "string" ? row.respond_by : null,
              expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
            }))
          );
        }
      }
    } catch {
      hostAwaitingApprovalCount = 0;
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

  return (
    <div className="mx-auto min-w-0 max-w-6xl px-4">
      <div className="flex min-w-0 flex-col gap-4 py-4 md:flex-row md:items-start md:gap-6">
        <div className="md:sticky md:top-20 md:w-64 md:shrink-0">
          <HostSidebar
            role={normalizedRole}
            awaitingApprovalCount={hostAwaitingApprovalCount}
            unreadMessages={unreadMessages}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-lg">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
                  Dashboard
                </p>
                <p className="text-xl font-semibold">{workspaceTitle}</p>
                <p className="text-sm text-slate-200">{workspaceCopy}</p>
              </div>
              {isAgent && agentNetworkEnabled ? (
                <Link
                  href="/dashboard/agent-network"
                  className="inline-flex rounded-lg border border-cyan-200/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                >
                  Open agent network
                </Link>
              ) : null}
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
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
