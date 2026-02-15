import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { SmartSearchBox } from "@/components/properties/SmartSearchBox";
import { Button } from "@/components/ui/Button";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { resolveServerRole } from "@/lib/auth/role";
import { getCountryByCode } from "@/lib/countries";
import {
  getCityCollections,
  getFeaturedHomes,
  getMostSavedHomes,
  getMostViewedHomes,
  getNewHomes,
  getPopularHomes,
  getShortletHomes,
  getTenantDiscoveryContext,
  getTrendingHomes,
} from "@/lib/tenant/tenant-discovery.server";
import { fetchSavedPropertyIds } from "@/lib/saved-properties.server";
import { fetchOwnerListings } from "@/lib/properties/owner-listings";
import { isListingExpired } from "@/lib/properties/expiry";
import { buildSummaryByProperty, fetchPropertyEvents, isUuid } from "@/lib/analytics/property-events.server";
import { getSavedSearchSummaryForUser } from "@/lib/saved-searches/summary.server";
import type { Property } from "@/lib/types";
import { fetchTrustPublicSnapshots } from "@/lib/trust-public";
import type { TrustMarkerState } from "@/lib/trust-markers";
import { getListingPopularitySignals, type ListingPopularitySignal } from "@/lib/properties/popularity.server";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getMarketSettings } from "@/lib/market/market.server";
import { MARKET_COOKIE_NAME, resolveMarketFromRequest } from "@/lib/market/market";
import { buildMarketHubHref, getMarketHubs } from "@/lib/market/hubs";
import { HomeBrowseCtaClient } from "@/components/market/HomeBrowseCtaClient";
import { MarketHubLink } from "@/components/market/MarketHubLink";
import { RoleChecklistPanel } from "@/components/checklists/RoleChecklistPanel";
import { loadHostChecklist } from "@/lib/checklists/role-checklists.server";

export const dynamic = "force-dynamic";

type Snapshot = {
  activeListings: number;
  views7d: number;
  saves7d: number;
  viewingRequests7d: number;
  partial: boolean;
};

const WORKSPACE_LINKS = [
  { href: "/host", label: "Listings" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/messages", label: "Messages" },
  { href: "/dashboard/referrals", label: "Referrals" },
] as const;

function formatCount(value: number) {
  return Math.max(0, Number(value || 0)).toLocaleString();
}

function formatMarketRegionLabel(countryCode: string): string {
  if (countryCode === "GB") return "the UK";
  return getCountryByCode(countryCode)?.name ?? countryCode;
}

function isActiveListing(property: Property) {
  if (isListingExpired(property)) return false;
  const status = String(property.status || "").trim().toLowerCase();
  if (status) {
    return status === "live" || status === "pending";
  }
  return Boolean(property.is_active);
}

async function getSnapshot(userId: string, context: Awaited<ReturnType<typeof getTenantDiscoveryContext>>): Promise<Snapshot> {
  const listingsResult = await fetchOwnerListings({
    supabase: context.supabase,
    ownerId: userId,
    isAdmin: false,
  });

  if (listingsResult.error) {
    return {
      activeListings: 0,
      views7d: 0,
      saves7d: 0,
      viewingRequests7d: 0,
      partial: true,
    };
  }

  const listings = listingsResult.data || [];
  const activeListings = listings.filter(isActiveListing).length;
  const propertyIds = listings.map((property) => property.id).filter(isUuid);

  if (!propertyIds.length) {
    return {
      activeListings,
      views7d: 0,
      saves7d: 0,
      viewingRequests7d: 0,
      partial: false,
    };
  }

  const eventResult = await fetchPropertyEvents({
    propertyIds,
    sinceDays: 7,
    client: context.supabase,
  });

  if (eventResult.error) {
    return {
      activeListings,
      views7d: 0,
      saves7d: 0,
      viewingRequests7d: 0,
      partial: true,
    };
  }

  const summaryByProperty = buildSummaryByProperty(eventResult.rows);
  let views7d = 0;
  let saves7d = 0;
  let viewingRequests7d = 0;

  for (const propertyId of propertyIds) {
    const summary = summaryByProperty.get(propertyId);
    if (!summary) continue;
    views7d += Math.max(0, summary.views);
    saves7d += Math.max(0, summary.netSaves);
    viewingRequests7d += Math.max(0, summary.viewingRequests);
  }

  return {
    activeListings,
    views7d,
    saves7d,
    viewingRequests7d,
    partial: false,
  };
}

function SectionHeader({
  title,
  description,
  href,
  hrefLabel = "View all",
}: {
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        {description ? <p className="text-sm text-slate-600">{description}</p> : null}
      </div>
      {href ? (
        <Link href={href} className="text-sm font-semibold text-sky-700">
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}

function PropertyRail({
  homes,
  viewerRole,
  savedIds,
  trustSnapshots,
  socialProofByListing,
}: {
  homes: Property[];
  viewerRole: "agent" | "landlord";
  savedIds: Set<string>;
  trustSnapshots: Record<string, TrustMarkerState>;
  socialProofByListing: Record<string, ListingPopularitySignal>;
}) {
  if (!homes.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-8 text-sm text-slate-600">
        Coming online as new listings are published.
      </div>
    );
  }

  return (
    <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {homes.map((property) => (
        <div key={property.id} className="min-w-[270px] max-w-[290px] flex-1">
          <PropertyCard
            property={property}
            href={`/properties/${property.id}`}
            showSave
            initialSaved={savedIds.has(property.id)}
            showCta={false}
            viewerRole={viewerRole}
            trustMarkers={trustSnapshots[property.owner_id]}
            socialProof={socialProofByListing[property.id] ?? null}
          />
        </div>
      ))}
    </div>
  );
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

  const [context, requestHeaders, cookieStore, marketSettings] = await Promise.all([
    getTenantDiscoveryContext(),
    headers(),
    cookies(),
    getMarketSettings(),
  ]);
  const market = resolveMarketFromRequest({
    headers: requestHeaders,
    cookieValue: cookieStore.get(MARKET_COOKIE_NAME)?.value ?? null,
    appSettings: marketSettings,
  });
  const cityCollections = getCityCollections();
  const marketHubs = getMarketHubs(market.country);
  const marketRegionLabel = formatMarketRegionLabel(market.country);
  const popularCity = context.profileCity?.trim() || marketHubs[0]?.label || cityCollections[0]?.city || null;
  const suggestedStartLabel = marketHubs[0]?.label ?? cityCollections[0]?.city ?? "top cities";
  const suggestedStartHref = marketHubs[0]
    ? buildMarketHubHref(marketHubs[0])
    : cityCollections[0]
      ? `/properties?city=${encodeURIComponent(cityCollections[0].city)}`
      : "/properties";
  const hubsForDisplay =
    marketHubs.length > 0
      ? marketHubs.map((hub) => ({
          key: hub.key,
          label: hub.label,
          caption: `Start your search in ${hub.label}.`,
          href: buildMarketHubHref(hub),
        }))
      : cityCollections.map((city) => ({
          key: city.city,
          label: city.city,
          caption: city.caption,
          href: `/properties?city=${encodeURIComponent(city.city)}`,
        }));
  const featuredListingsEnabled = await getAppSettingBool(
    APP_SETTING_KEYS.featuredListingsEnabled,
    true
  );

  const [
    gettingStartedChecklist,
    snapshot,
    savedSearchSummary,
    featuredHomes,
    trendingHomes,
    mostSavedHomes,
    mostViewedHomes,
    shortletHomes,
    newHomes,
    popularHomes,
  ] = await Promise.all([
    loadHostChecklist({
      supabase: context.supabase,
      userId: user.id,
      role,
    }),
    getSnapshot(user.id, context),
    getSavedSearchSummaryForUser({
      supabase: context.supabase,
      userId: user.id,
    }).catch(() => ({ totalNewMatches: 0, searches: [] })),
    featuredListingsEnabled ? getFeaturedHomes({ limit: 8, context }) : Promise.resolve([]),
    getTrendingHomes({ limit: 10, marketCountryCode: market.country, context }),
    getMostSavedHomes({ limit: 10, marketCountryCode: market.country, context }),
    getMostViewedHomes({ limit: 10, marketCountryCode: market.country, context }),
    getShortletHomes({ city: popularCity, limit: 8, context }),
    getNewHomes({ days: 7, limit: 8, context }),
    getPopularHomes({ city: popularCity, limit: 8, context }),
  ]);

  const railPropertyIds = Array.from(
    new Set(
      [
        ...featuredHomes,
        ...trendingHomes,
        ...mostSavedHomes,
        ...mostViewedHomes,
        ...shortletHomes,
        ...newHomes,
        ...popularHomes,
      ].map((property) => property.id)
    )
  );

  const savedIds = railPropertyIds.length
    ? await fetchSavedPropertyIds({
        supabase: context.supabase,
        userId: user.id,
        propertyIds: railPropertyIds,
      })
    : new Set<string>();
  const railOwnerIds = Array.from(
    new Set(
      [...featuredHomes, ...newHomes, ...popularHomes]
        .concat(trendingHomes, mostSavedHomes, mostViewedHomes, shortletHomes)
        .map((property) => property.owner_id)
        .filter(Boolean)
    )
  );
  const [trustSnapshots, socialProofByListing] = await Promise.all([
    railOwnerIds.length
      ? fetchTrustPublicSnapshots(context.supabase, railOwnerIds)
      : Promise.resolve({} as Record<string, TrustMarkerState>),
    railPropertyIds.length
      ? getListingPopularitySignals({
          client: context.supabase,
          listingIds: railPropertyIds,
        })
      : Promise.resolve({} as Record<string, ListingPopularitySignal>),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-10 text-white shadow-xl md:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.35),transparent_40%),radial-gradient(circle_at_80%_0,rgba(56,189,248,0.25),transparent_30%)]" />
        <div className="relative grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
              Workspace home
            </p>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
              Welcome back
            </h1>
            <p className="text-base text-slate-200">
              Keep your listings active, respond to leads quickly, and track referral growth from one place.
            </p>
            <HomeBrowseCtaClient
              fallbackHref={suggestedStartHref}
              fallbackLabel={suggestedStartLabel}
            />
          </div>
          <div className="rounded-2xl bg-white/95 p-4 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.3)]">
            <SmartSearchBox mode="browse" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Workspace</h2>
            <p className="text-sm text-slate-600">Jump into the tools you use most.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {WORKSPACE_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button variant="secondary">{link.label}</Button>
            </Link>
          ))}
        </div>
      </section>

      <RoleChecklistPanel
        title="Getting started checklist"
        subtitle="Track the fundamentals that drive listing quality and conversion."
        items={gettingStartedChecklist}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Your snapshot</h2>
            <p className="text-sm text-slate-600">Last 7 days across your workspace.</p>
          </div>
          {snapshot.partial ? (
            <p className="text-xs font-medium text-amber-700">
              Some metrics are still coming online.
            </p>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Active listings</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCount(snapshot.activeListings)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Views (7d)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCount(snapshot.views7d)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Saves (7d)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCount(snapshot.saves7d)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Viewing requests (7d)</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCount(snapshot.viewingRequests7d)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Demand alerts</h2>
            <p className="text-sm text-slate-600">
              New matches for searches you follow.
            </p>
          </div>
          <Link href="/saved-searches" className="text-sm font-semibold text-sky-700">
            Manage searches
          </Link>
        </div>
        <p className="mt-3 text-sm text-slate-700">
          {savedSearchSummary.totalNewMatches > 0
            ? `${savedSearchSummary.totalNewMatches} new matches across your followed searches.`
            : "No new matches yet. Follow searches from Browse to track demand."}
        </p>
        {savedSearchSummary.searches.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {savedSearchSummary.searches.slice(0, 3).map((search) => (
              <div
                key={search.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <p className="text-sm font-semibold text-slate-900">{search.name}</p>
                <p className="text-xs text-slate-600">
                  {search.newMatchesCount} new matches
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {featuredListingsEnabled && featuredHomes.length > 0 ? (
        <section className="space-y-4" data-testid="home-featured-homes">
          <SectionHeader
            title="Featured homes"
            description="What renters are seeing first."
            href="/properties?featured=true"
          />
          <PropertyRail
            homes={featuredHomes}
            viewerRole={role}
            savedIds={savedIds}
            trustSnapshots={trustSnapshots}
            socialProofByListing={socialProofByListing}
          />
        </section>
      ) : null}

      {trendingHomes.length > 0 ? (
        <section className="space-y-4" data-testid="home-trending-homes">
          <SectionHeader
            title="Trending this week"
            description={`Popular with renters in ${marketRegionLabel} and beyond, based on recent views and saves.`}
            href="/help/trending"
            hrefLabel="What is this?"
          />
          <PropertyRail
            homes={trendingHomes}
            viewerRole={role}
            savedIds={savedIds}
            trustSnapshots={trustSnapshots}
            socialProofByListing={socialProofByListing}
          />
        </section>
      ) : null}

      {mostSavedHomes.length > 0 ? (
        <section className="space-y-4" data-testid="home-most-saved-homes">
          <SectionHeader
            title="Most saved"
            description={`Homes with strong shortlist activity in ${marketRegionLabel} and beyond.`}
            href="/properties"
            hrefLabel="Browse all"
          />
          <PropertyRail
            homes={mostSavedHomes}
            viewerRole={role}
            savedIds={savedIds}
            trustSnapshots={trustSnapshots}
            socialProofByListing={socialProofByListing}
          />
        </section>
      ) : null}

      {mostViewedHomes.length > 0 ? (
        <section className="space-y-4" data-testid="home-most-viewed-homes">
          <SectionHeader
            title="Most viewed"
            description={`Homes drawing the highest viewing activity across ${marketRegionLabel} and beyond.`}
            href="/properties"
            hrefLabel="Browse all"
          />
          <PropertyRail
            homes={mostViewedHomes}
            viewerRole={role}
            savedIds={savedIds}
            trustSnapshots={trustSnapshots}
            socialProofByListing={socialProofByListing}
          />
        </section>
      ) : null}

      {shortletHomes.length > 0 ? (
        <section className="space-y-4" data-testid="home-shortlet-homes">
          <SectionHeader
            title="Shortlets to book"
            description="Book stays by the night - Lagos and beyond."
            href="/properties?stay=shortlet"
            hrefLabel="Browse shortlets"
          />
          <PropertyRail
            homes={shortletHomes}
            viewerRole={role}
            savedIds={savedIds}
            trustSnapshots={trustSnapshots}
            socialProofByListing={socialProofByListing}
          />
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          title={`New this week in ${marketRegionLabel}`}
          description={`Fresh inventory added in the last 7 days across ${marketRegionLabel}.`}
          href="/properties?sort=newest"
        />
        <PropertyRail
          homes={newHomes}
          viewerRole={role}
          savedIds={savedIds}
          trustSnapshots={trustSnapshots}
          socialProofByListing={socialProofByListing}
        />
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Popular cities & hubs"
          description={`Suggested starting points in ${marketRegionLabel}.`}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hubsForDisplay.map((hub) => (
            <MarketHubLink
              key={hub.key}
              href={hub.href}
              country={market.country}
              label={hub.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Explore</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{hub.label}</p>
              <p className="text-sm text-slate-600">{hub.caption}</p>
            </MarketHubLink>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title={`Popular in ${marketRegionLabel}`}
          description={
            popularCity
              ? `Listings attracting strong attention, with ${popularCity} as a top starting point.`
              : "Listings attracting strong attention."
          }
          href={popularCity ? `/properties?city=${encodeURIComponent(popularCity)}` : "/properties"}
        />
        <PropertyRail
          homes={popularHomes}
          viewerRole={role}
          savedIds={savedIds}
          trustSnapshots={trustSnapshots}
          socialProofByListing={socialProofByListing}
        />
      </section>
    </div>
  );
}
