import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { HostFeaturedStrip } from "@/components/host/HostFeaturedStrip";
import { HostListingsMasonryGrid } from "@/components/host/HostListingsMasonryGrid";
import type { DashboardListing } from "@/lib/properties/host-dashboard";

type WorkspaceHomeRole = "agent" | "landlord";

export function WorkspaceHomeFeed({
  role,
  listings,
}: {
  role: WorkspaceHomeRole;
  listings: DashboardListing[];
}) {
  return (
    <section className="space-y-4" data-testid="home-workspace-feed">
      <section
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        data-testid="home-workspace-hero"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
              Workspace home
            </p>
            <h1 className="text-3xl font-semibold text-slate-900">Lead with your strongest listings.</h1>
            <p className="text-sm text-slate-600">
              Publish faster, follow demand, and jump straight into daily actions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/properties/new" data-testid="home-feed-cta-create-listing">
              <Button>Create listing</Button>
            </Link>
            <Link href="/host/bookings" data-testid="home-feed-cta-view-bookings">
              <Button variant="secondary">View bookings</Button>
            </Link>
            <Link
              href={role === "agent" ? "/host/leads" : "/host/listings?view=manage"}
              data-testid={
                role === "agent" ? "home-feed-cta-view-leads" : "home-feed-cta-manage-properties"
              }
            >
              <Button variant="secondary">{role === "agent" ? "View leads" : "Manage properties"}</Button>
            </Link>
          </div>
        </div>
      </section>

      <div data-testid="home-featured-strip">
        <HostFeaturedStrip listings={listings} mosaicTargetId="home-for-you-grid" />
      </div>

      <section id="home-for-you-grid" className="space-y-3" data-testid="home-for-you-grid">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">For you</p>
            <h2 className="text-xl font-semibold text-slate-900">Portfolio mosaic</h2>
          </div>
          <Link
            href="/host/listings?view=manage"
            className="text-xs font-semibold text-sky-700 hover:text-sky-800"
          >
            Open manager
          </Link>
        </div>
        <HostListingsMasonryGrid listings={listings} uniformMedia />
      </section>
    </section>
  );
}
