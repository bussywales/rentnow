import Link from "next/link";
import { redirect } from "next/navigation";
import { HostFeaturedStrip } from "@/components/host/HostFeaturedStrip";
import { HostListingsMasonryGrid } from "@/components/host/HostListingsMasonryGrid";
import { RoleChecklistPanel } from "@/components/checklists/RoleChecklistPanel";
import { Button } from "@/components/ui/Button";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { resolveServerRole } from "@/lib/auth/role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadHostChecklist } from "@/lib/checklists/role-checklists.server";
import { fetchOwnerListings } from "@/lib/properties/owner-listings";
import { computeDashboardListings, type DashboardListing } from "@/lib/properties/host-dashboard";
import { isListingExpired } from "@/lib/properties/expiry";
import { getSavedSearchSummaryForUser } from "@/lib/saved-searches/summary.server";
import { summarizeChecklist } from "@/lib/checklists/role-checklists";

export const dynamic = "force-dynamic";

type Snapshot = {
  totalListings: number;
  activeListings: number;
  pendingListings: number;
  updatedThisWeek: number;
};

const WORKSPACE_LINKS = [
  { href: "/host/properties", label: "Manage properties" },
  { href: "/host/bookings", label: "Bookings" },
  { href: "/host/leads", label: "Leads" },
  { href: "/dashboard/messages", label: "Messages" },
  { href: "/dashboard/referrals", label: "Referrals" },
] as const;

function formatCount(value: number) {
  return Math.max(0, Number(value || 0)).toLocaleString();
}

function isActiveListing(listing: DashboardListing) {
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
  const [listingsResult, gettingStartedChecklist, savedSearchSummary] = await Promise.all([
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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-1 sm:px-6 lg:px-8" data-testid="home-visual-landing">
      <section
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        data-testid="home-hero"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
              Workspace home
            </p>
            <h1 className="text-3xl font-semibold text-slate-900">Make your next listing impossible to ignore.</h1>
            <p className="text-sm text-slate-600">
              Publish faster, keep approvals moving, and manage your portfolio from one visual workspace.
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
      </section>

      <section className="space-y-3" data-testid="home-featured-strip">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Featured</p>
            <h2 className="text-xl font-semibold text-slate-900">Listings to spotlight now</h2>
          </div>
          <Link href="/host/properties" className="text-xs font-semibold text-sky-700 hover:text-sky-800">
            Manage all
          </Link>
        </div>
        {dashboardListings.length ? (
          <HostFeaturedStrip listings={dashboardListings} mosaicTargetId="home-for-you-grid" />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
            Add your first listing to unlock a featured strip.
          </div>
        )}
      </section>

      <section id="home-for-you-grid" className="space-y-3" data-testid="home-for-you-grid">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">For you</p>
            <h2 className="text-xl font-semibold text-slate-900">Editorial portfolio grid</h2>
          </div>
          <Link href="/host/properties" className="text-xs font-semibold text-sky-700 hover:text-sky-800">
            Open manager
          </Link>
        </div>
        <HostListingsMasonryGrid listings={dashboardListings} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="home-workspace-tools">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Workspace tools</h2>
            <p className="text-sm text-slate-600">Technical controls stay available without crowding your listings feed.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {WORKSPACE_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button variant="secondary">{link.label}</Button>
            </Link>
          ))}
        </div>
      </section>

      <section data-testid="home-getting-started">
        <RoleChecklistPanel
          title="Getting started checklist"
          subtitle={
            checklistRemaining > 0
              ? `${checklistRemaining} items to complete.`
              : "All key setup milestones are complete."
          }
          items={gettingStartedChecklist}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="home-snapshot-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Snapshot</h2>
            <p className="text-sm text-slate-600">Current portfolio health at a glance.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="home-demand-alerts">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Demand alerts</h2>
            <p className="text-sm text-slate-600">Keep an eye on saved-search demand from tenants.</p>
          </div>
          <Link href="/saved-searches" className="text-sm font-semibold text-sky-700">
            Manage searches
          </Link>
        </div>
        <p className="mt-3 text-sm text-slate-700">
          {savedSearchSummary.totalNewMatches > 0
            ? `${savedSearchSummary.totalNewMatches} new matches across followed searches.`
            : "No new matches yet. Follow searches from Browse to track demand."}
        </p>
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
      </section>

      {listingsResult.error ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="home-listing-fetch-warning">
          We could not load some listing details right now. Please refresh to retry.
        </section>
      ) : null}
    </div>
  );
}
