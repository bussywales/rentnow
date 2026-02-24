"use client";

import { HostPropertiesManager } from "@/components/host/HostPropertiesManager";
import type { DashboardListing } from "@/lib/properties/host-dashboard";

type Props = {
  listings: DashboardListing[];
  loadError?: string | null;
};

export function HostListingsManager({ listings, loadError = null }: Props) {
  return (
    <section className="space-y-4" data-testid="host-listings-manager">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Listings</h1>
        <p className="text-sm text-slate-600">Manage portfolio health and listing operations.</p>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {loadError}
        </div>
      ) : (
        <HostPropertiesManager listings={listings} />
      )}
    </section>
  );
}
