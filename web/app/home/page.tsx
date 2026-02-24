import Link from "next/link";
import { redirect } from "next/navigation";
import { HomeListingRail } from "@/components/home/HomeListingRail";
import { HostGettingStartedSection } from "@/components/host/HostGettingStartedSection";
import { HostListingsMasonryGrid } from "@/components/host/HostListingsMasonryGrid";
import { RoleChecklistPanel } from "@/components/checklists/RoleChecklistPanel";
import { HomeCollapsibleSection } from "@/components/home/HomeCollapsibleSection";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { Button } from "@/components/ui/Button";
import { loadHostChecklist } from "@/lib/checklists/role-checklists.server";
import { summarizeChecklist } from "@/lib/checklists/role-checklists";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { resolveServerRole } from "@/lib/auth/role";
import { buildHomeCollapsedStorageKey } from "@/lib/home/collapsible";
import { loadHomeFeedRails } from "@/lib/home/home-feed.server";
import { fetchOwnerListings } from "@/lib/properties/owner-listings";
import { computeDashboardListings, type DashboardListing } from "@/lib/properties/host-dashboard";
import { isListingExpired } from "@/lib/properties/expiry";
import { getSavedSearchSummaryForUser } from "@/lib/saved-searches/summary.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTenantDiscoveryContext } from "@/lib/tenant/tenant-discovery.server";

export const dynamic = "force-dynamic";

const WORKSPACE_LINKS = [
  { href: "/host/properties", label: "Manage properties" },
  { href: "/host/bookings", label: "Bookings" },
  { href: "/host/calendar", label: "Calendar" },
  { href: "/host/earnings", label: "Earnings" },
] as const;

const AGENT_QUICK_LINKS = [
  { href: "/profile/clients", label: "Client pages" },
  { href: "/host/leads", label: "Leads" },
  { href: "/dashboard/messages", label: "Messages" },
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
  const [listingsResult, gettingStartedChecklist, savedSearchSummary, discoveryContext] =
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
      getTenantDiscoveryContext(),
    ]);

  const dashboardListings = computeDashboardListings(listingsResult.data || []);
  const listingSnapshot = buildSnapshot(dashboardListings);
  const checklistSummary = summarizeChecklist(gettingStartedChecklist);
  const checklistRemaining = Math.max(0, checklistSummary.total - checklistSummary.done);

  const feedRails = await loadHomeFeedRails({
    context: discoveryContext,
    fallbackListings: listingsResult.data || [],
  }).catch(() => ({
    featured: (listingsResult.data || []).slice(0, 6),
    newThisWeek: (listingsResult.data || []).slice(0, 6),
    mostSaved: (listingsResult.data || []).slice(0, 6),
    mostViewed: (listingsResult.data || []).slice(0, 6),
    shortletsToBook: (listingsResult.data || []).slice(0, 6),
  }));
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
  };

  return (
    <WorkspaceShell role={role} contentClassName="space-y-5">
      <div className="flex flex-col gap-5 py-1" data-testid="home-visual-landing">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="home-hero">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
              Workspace home
            </p>
            <h1 className="text-3xl font-semibold text-slate-900">Lead with your strongest listings.</h1>
            <p className="text-sm text-slate-600">
              Keep your portfolio visible, ship updates faster, and jump into management workflows when you are ready.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/properties/new">
              <Button>Create listing</Button>
            </Link>
            <Link href="/host/properties">
              <Button variant="secondary">Manage properties</Button>
            </Link>
          </div>
        </div>
        {role === "agent" ? (
          <div
            className="mt-4 flex flex-wrap items-center gap-2"
            data-testid="home-agent-quick-chips"
          >
            {AGENT_QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <HomeListingRail
        title="Featured listings"
        subtitle="Top homes to spotlight"
        href="/host/properties"
        hrefLabel="Manage all"
        listings={feedRails.featured}
        source="home_featured"
        sectionTestId="home-featured-strip"
      />

      <HomeListingRail
        title="New this week"
        subtitle="Fresh inventory worth reviewing"
        listings={feedRails.newThisWeek}
        source="home_new_this_week"
        sectionTestId="home-rail-new-this-week"
      />

      <HomeListingRail
        title="Most saved"
        subtitle="Homes tenants are bookmarking"
        listings={feedRails.mostSaved}
        source="home_most_saved"
        sectionTestId="home-rail-most-saved"
      />

      <HomeListingRail
        title="Most viewed"
        subtitle="Homes driving the strongest attention"
        listings={feedRails.mostViewed}
        source="home_most_viewed"
        sectionTestId="home-rail-most-viewed"
      />

      <section id="home-for-you-grid" className="space-y-3" data-testid="home-for-you-grid">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">For you</p>
            <h2 className="text-xl font-semibold text-slate-900">Portfolio mosaic</h2>
          </div>
          <Link href="/host/properties" className="text-xs font-semibold text-sky-700 hover:text-sky-800">
            Open manager
          </Link>
        </div>
        <HostListingsMasonryGrid listings={dashboardListings} uniformMedia />
      </section>

      <HomeCollapsibleSection
        title="Workspace tools"
        description="Operational controls are always available, but no longer block your feed."
        storageKey={collapsedKeys.workspaceTools}
        defaultCollapsed
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
        defaultCollapsed
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
        defaultCollapsed
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
        defaultCollapsed
        testId="home-analytics-panel"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Featured feed cards</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCount(feedRails.featured.length)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Shortlets to book</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCount(feedRails.shortletsToBook.length)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Most saved candidates</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCount(feedRails.mostSaved.length)}</p>
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
        defaultCollapsed
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

      {listingsResult.error ? (
        <section
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          data-testid="home-listing-fetch-warning"
        >
          We could not load some listing details right now. Please refresh to retry.
        </section>
      ) : null}
      </div>
    </WorkspaceShell>
  );
}
