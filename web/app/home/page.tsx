import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceHomeFeed } from "@/components/home/WorkspaceHomeFeed";
import { HostGettingStartedSection } from "@/components/host/HostGettingStartedSection";
import { RoleChecklistPanel } from "@/components/checklists/RoleChecklistPanel";
import { HomeCollapsibleSection } from "@/components/home/HomeCollapsibleSection";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { Button } from "@/components/ui/Button";
import { loadHostChecklist } from "@/lib/checklists/role-checklists.server";
import { summarizeChecklist } from "@/lib/checklists/role-checklists";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { resolveServerRole } from "@/lib/auth/role";
import { buildHomeCollapsedStorageKey } from "@/lib/home/collapsible";
import { fetchOwnerListings } from "@/lib/properties/owner-listings";
import { computeDashboardListings, type DashboardListing } from "@/lib/properties/host-dashboard";
import { isListingExpired } from "@/lib/properties/expiry";
import { getSavedSearchSummaryForUser } from "@/lib/saved-searches/summary.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const WORKSPACE_LINKS = [
  { href: "/host/properties", label: "Manage properties" },
  { href: "/host/bookings", label: "Bookings" },
  { href: "/host/calendar", label: "Calendar" },
  { href: "/host/earnings", label: "Earnings" },
] as const;

type Snapshot = {
  totalListings: number;
  activeListings: number;
  pendingListings: number;
  updatedThisWeek: number;
};

function formatCount(value: number): string {
  return Math.max(0, Number(value || 0)).toLocaleString();
}

function isActiveListing(listing: DashboardListing): boolean {
  if (isListingExpired(listing)) return false;
  const status = String(listing.status || "").trim().toLowerCase();
  if (status) {
    return status === "live" || status === "pending";
  }
  return Boolean(listing.is_active);
}

function buildSnapshot(listings: DashboardListing[]): Snapshot {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const pendingListings = listings.filter((listing) => {
    const status = String(listing.status || "").trim().toLowerCase();
    return status === "pending";
  }).length;

  const updatedThisWeek = listings.filter((listing) => {
    const timestamp = Date.parse(listing.updated_at || listing.created_at || "");
    return Number.isFinite(timestamp) && now - timestamp <= sevenDaysMs;
  }).length;

  return {
    totalListings: listings.length,
    activeListings: listings.filter(isActiveListing).length,
    pendingListings,
    updatedThisWeek,
  };
}

export default async function HomeWorkspacePage() {
  const { user, role } = await resolveServerRole();

  if (!user) {
    logAuthRedirect("/home");
    redirect("/auth/required?redirect=/home&reason=auth");
  }

  if (!role) {
    redirect("/onboarding");
  }

  if (role === "tenant") {
    redirect("/tenant/home");
  }

  if (role === "admin") {
    redirect("/admin");
  }

  if (role !== "agent" && role !== "landlord") {
    redirect("/forbidden?reason=role");
  }

  const supabase = await createServerSupabaseClient();
  const [listingsResult, gettingStartedChecklist, savedSearchSummary] =
    await Promise.all([
      fetchOwnerListings({
        supabase,
        ownerId: user.id,
        isAdmin: false,
      }),
      loadHostChecklist({
        supabase,
        userId: user.id,
        role,
      }),
      getSavedSearchSummaryForUser({
        supabase,
        userId: user.id,
      }).catch(() => ({ totalNewMatches: 0, searches: [] })),
    ]);

  const dashboardListings = computeDashboardListings(listingsResult.data || []);
  const listingSnapshot = buildSnapshot(dashboardListings);
  const checklistSummary = summarizeChecklist(gettingStartedChecklist);
  const checklistRemaining = Math.max(0, checklistSummary.total - checklistSummary.done);
  const featuredCardsCount = Math.min(dashboardListings.length, 6);
  const shortletListingsCount = dashboardListings.filter(
    (listing) => String(listing.listing_intent || "").toLowerCase() === "shortlet"
  ).length;
  const readyListingsCount = dashboardListings.filter(
    (listing) => String(listing.status || "").toLowerCase() === "live"
  ).length;
  const technicalPanelsCollapsedByDefault = true;
  const collapsedKeys = {
    workspaceTools: buildHomeCollapsedStorageKey({
      role,
      userId: user.id,
      section: "workspace-tools",
      version: "v2",
    }),
    gettingStarted: buildHomeCollapsedStorageKey({
      role,
      userId: user.id,
      section: "getting-started",
      version: "v2",
    }),
    snapshot: buildHomeCollapsedStorageKey({
      role,
      userId: user.id,
      section: "snapshot",
      version: "v2",
    }),
    demandAlerts: buildHomeCollapsedStorageKey({
      role,
      userId: user.id,
      section: "demand-alerts",
      version: "v2",
    }),
    analyticsPreview: buildHomeCollapsedStorageKey({
      role,
      userId: user.id,
      section: "analytics-preview",
      version: "v2",
    }),
    opsDiagnostics: buildHomeCollapsedStorageKey({
      role,
      userId: user.id,
      section: "ops-diagnostics",
      version: "v2",
    }),
  };

  return (
    <WorkspaceShell role={role} contentClassName="space-y-5">
      <div className="flex flex-col gap-5 py-1" data-testid="home-visual-landing">
        <WorkspaceHomeFeed role={role} listings={dashboardListings} />

        <HomeCollapsibleSection
          title="Workspace tools"
          description="Operational controls are always available, but no longer block your feed."
          storageKey={collapsedKeys.workspaceTools}
          defaultCollapsed={technicalPanelsCollapsedByDefault}
          testId="home-workspace-tools"
        >
          <div className="flex flex-wrap gap-2">
            {WORKSPACE_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button variant="secondary">{link.label}</Button>
              </Link>
            ))}
          </div>
        </HomeCollapsibleSection>

        <HostGettingStartedSection
          role={role}
          hostUserId={user.id}
          items={gettingStartedChecklist}
          title="Getting started checklist"
          description={
            checklistRemaining > 0
              ? `${checklistRemaining} items to complete.`
              : "All key setup milestones are complete."
          }
          storageKey={collapsedKeys.gettingStarted}
          defaultCollapsed={technicalPanelsCollapsedByDefault}
          testId="home-getting-started"
        >
          <RoleChecklistPanel
            title="Getting started checklist"
            subtitle={
              checklistRemaining > 0
                ? `${checklistRemaining} items to complete.`
                : "All key setup milestones are complete."
            }
            items={gettingStartedChecklist}
          />
        </HostGettingStartedSection>

        <HomeCollapsibleSection
          title="Snapshot"
          description="Current portfolio health at a glance."
          storageKey={collapsedKeys.snapshot}
          defaultCollapsed={technicalPanelsCollapsedByDefault}
          testId="home-snapshot-panel"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total listings</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCount(listingSnapshot.totalListings)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Active listings</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCount(listingSnapshot.activeListings)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Pending approval</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCount(listingSnapshot.pendingListings)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Updated this week</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCount(listingSnapshot.updatedThisWeek)}</p>
            </div>
          </div>
        </HomeCollapsibleSection>

        <HomeCollapsibleSection
          title="Analytics preview"
          description="Compact demand diagnostics for this week."
          storageKey={collapsedKeys.analyticsPreview}
          defaultCollapsed={technicalPanelsCollapsedByDefault}
          testId="home-analytics-panel"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Featured feed cards</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCount(featuredCardsCount)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Shortlets to book</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCount(shortletListingsCount)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Ready to market</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCount(readyListingsCount)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">New demand matches</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {formatCount(savedSearchSummary.totalNewMatches)}
              </p>
            </div>
          </div>
        </HomeCollapsibleSection>

        <HomeCollapsibleSection
          title="Demand alerts"
          description="Saved-search signals and tenant demand, without overwhelming the top of page."
          storageKey={collapsedKeys.demandAlerts}
          defaultCollapsed={technicalPanelsCollapsedByDefault}
          testId="home-demand-alerts"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="text-sm text-slate-700">
              {savedSearchSummary.totalNewMatches > 0
                ? `${savedSearchSummary.totalNewMatches} new matches across followed searches.`
                : "No new matches yet. Follow searches from Browse to track demand."}
            </div>
            <Link href="/saved-searches" className="text-sm font-semibold text-sky-700">
              Manage searches
            </Link>
          </div>
          {savedSearchSummary.searches.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {savedSearchSummary.searches.slice(0, 3).map((search) => (
                <div key={search.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">{search.name}</p>
                  <p className="text-xs text-slate-600">{search.newMatchesCount} new matches</p>
                </div>
              ))}
            </div>
          ) : null}
        </HomeCollapsibleSection>

        <HomeCollapsibleSection
          title="Ops diagnostics"
          description="System checks and fetch reliability updates."
          storageKey={collapsedKeys.opsDiagnostics}
          defaultCollapsed={technicalPanelsCollapsedByDefault}
          testId="home-ops-diagnostics"
        >
          {listingsResult.error ? (
            <section
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              data-testid="home-listing-fetch-warning"
            >
              We could not load some listing details right now. Please refresh to retry.
            </section>
          ) : (
            <p className="text-sm text-slate-600" data-testid="home-ops-diagnostics-ok">
              No active diagnostics issues right now.
            </p>
          )}
        </HomeCollapsibleSection>
      </div>
    </WorkspaceShell>
  );
}
