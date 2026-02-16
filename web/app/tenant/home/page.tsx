import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SmartSearchBox } from "@/components/properties/SmartSearchBox";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { ContinueSearchCard } from "@/components/tenant/ContinueSearchCard";
import { Button } from "@/components/ui/Button";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { resolveServerRole } from "@/lib/auth/role";
import { getCountryByCode } from "@/lib/countries";
import { DEV_MOCKS } from "@/lib/env";
import { mockProperties } from "@/lib/mock";
import { resolveJurisdiction } from "@/lib/legal/jurisdiction.server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  getCityCollections,
  buildTenantDiscoveryModules,
  getFallbackHomes,
  getFeaturedHomes,
  getMostSavedHomes,
  getMostViewedHomes,
  getNewHomes,
  getPopularHomes,
  getShortletHomes,
  getTenantDiscoveryContext,
  getSavedHomes,
  getTrendingHomes,
} from "@/lib/tenant/tenant-discovery.server";
import type { Property } from "@/lib/types";
import { fetchSavedPropertyIds } from "@/lib/saved-properties.server";
import { getFastResponderByHostIds } from "@/lib/trust/fast-responder.server";
import { fetchTrustPublicSnapshots } from "@/lib/trust-public";
import type { TrustMarkerState } from "@/lib/trust-markers";
import { logPropertyEventsBulk, isUuid } from "@/lib/analytics/property-events.server";
import { getSessionKeyFromCookies, getSessionKeyFromUser } from "@/lib/analytics/session.server";
import { getSavedSearchSummaryForUser } from "@/lib/saved-searches/summary.server";
import { getListingPopularitySignals, type ListingPopularitySignal } from "@/lib/properties/popularity.server";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getMarketSettings } from "@/lib/market/market.server";
import { MARKET_COOKIE_NAME, resolveMarketFromRequest } from "@/lib/market/market";
import { buildMarketHubHref, getMarketHubs } from "@/lib/market/hubs";
import { HomeBrowseCtaClient } from "@/components/market/HomeBrowseCtaClient";
import { MarketHubLink } from "@/components/market/MarketHubLink";
import { RoleChecklistPanel } from "@/components/checklists/RoleChecklistPanel";
import { NextBestActionsPanel } from "@/components/checklists/NextBestActionsPanel";
import { HelpDrawerTrigger } from "@/components/help/HelpDrawerTrigger";
import { loadTenantChecklist } from "@/lib/checklists/role-checklists.server";

export const dynamic = "force-dynamic";

const MODULE_LIMIT = 10;

const DEFAULT_CITY_BY_JURISDICTION: Record<string, string> = {
  NG: "Lagos",
  GH: "Accra",
  KE: "Nairobi",
  ZA: "Johannesburg",
  UG: "Kampala",
  EG: "Cairo",
  RW: "Kigali",
  US: "New York",
  GB: "London",
};

type SectionHeaderProps = {
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
};

function SectionHeader({ title, description, href, hrefLabel = "View all" }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-600">{description}</p>}
      </div>
      {href && (
        <Link href={href} className="text-sm font-semibold text-sky-700">
          {hrefLabel}
        </Link>
      )}
    </div>
  );
}

function PropertyRow({
  items,
  testId,
  savedIds,
  fastResponderByHost,
  trustSnapshots,
  source,
  socialProofByListing,
}: {
  items: Property[];
  testId?: string;
  savedIds?: Set<string>;
  fastResponderByHost?: Record<string, boolean>;
  trustSnapshots?: Record<string, TrustMarkerState>;
  source?: string;
  socialProofByListing?: Record<string, ListingPopularitySignal>;
}) {
  return (
    <div
      data-testid={testId}
      className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
    >
      {items.map((property) => (
        <div
          key={property.id}
          data-testid="tenant-home-card"
          className="min-w-[260px] max-w-[280px] flex-1"
        >
          <PropertyCard
            property={property}
            href={
              source
                ? `/properties/${property.id}?source=${encodeURIComponent(source)}`
                : `/properties/${property.id}`
            }
            showSave
            initialSaved={savedIds?.has(property.id)}
            showCta
            viewerRole="tenant"
            fastResponder={fastResponderByHost?.[property.owner_id]}
            trustMarkers={trustSnapshots?.[property.owner_id]}
            socialProof={socialProofByListing?.[property.id] ?? null}
          />
        </div>
      ))}
    </div>
  );
}

function formatMarketRegionLabel(countryCode: string): string {
  if (countryCode === "GB") return "the UK";
  return getCountryByCode(countryCode)?.name ?? countryCode;
}

export default async function TenantHomePage() {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Tenant home</h1>
        <p className="text-sm text-slate-600">
          Supabase is not configured, so discovery is unavailable right now.
        </p>
      </div>
    );
  }

  const { user, role } = await resolveServerRole();
  if (!user) {
    logAuthRedirect("/tenant/home");
    redirect("/auth/login?reason=auth");
  }
  if (!role) {
    redirect("/onboarding");
  }
  if (role !== "tenant") {
    redirect(role === "admin" ? "/admin/support" : "/host");
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
  const marketHubs = getMarketHubs(market.country);
  const marketRegionLabel = formatMarketRegionLabel(market.country);
  const cityCollections = getCityCollections();
  const fallbackCity = cityCollections[0]?.city ?? null;

  let jurisdictionCode = context.profileJurisdiction ?? null;
  if (!jurisdictionCode) {
    jurisdictionCode = await resolveJurisdiction({
      userId: user.id,
      supabase: context.supabase,
    });
  }

  const popularCity =
    context.profileCity ??
    marketHubs[0]?.label ??
    (jurisdictionCode ? DEFAULT_CITY_BY_JURISDICTION[jurisdictionCode] : null) ??
    fallbackCity;

  const popularHeading = `Popular in ${marketRegionLabel}`;
  const newThisWeekHeading = `New this week in ${marketRegionLabel}`;
  const suggestedStartLabel = marketHubs[0]?.label ?? popularCity ?? fallbackCity ?? "top cities";
  const suggestedStartHref = marketHubs[0]
    ? buildMarketHubHref(marketHubs[0])
    : popularCity
      ? `/properties?city=${encodeURIComponent(popularCity)}`
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
    savedSearchSummary,
    featuredHomes,
    trendingHomes,
    mostSavedHomes,
    mostViewedHomes,
    shortletHomes,
    popularHomes,
    newHomes,
    savedHomes,
  ] = await Promise.all([
    loadTenantChecklist({
      supabase: context.supabase,
      userId: user.id,
    }),
    getSavedSearchSummaryForUser({
      supabase: context.supabase,
      userId: user.id,
    }).catch(() => ({ totalNewMatches: 0, searches: [] })),
    featuredListingsEnabled
      ? getFeaturedHomes({ limit: MODULE_LIMIT, context })
      : Promise.resolve([]),
    getTrendingHomes({ limit: MODULE_LIMIT, marketCountryCode: market.country, context }),
    getMostSavedHomes({ limit: MODULE_LIMIT, marketCountryCode: market.country, context }),
    getMostViewedHomes({ limit: MODULE_LIMIT, marketCountryCode: market.country, context }),
    getShortletHomes({ city: popularCity, limit: MODULE_LIMIT, context }),
    getPopularHomes({ city: popularCity, limit: MODULE_LIMIT, context }),
    getNewHomes({ days: 7, limit: MODULE_LIMIT, context }),
    getSavedHomes({ limit: 8, context }),
  ]);

  const cookieSessionKey = await getSessionKeyFromCookies();
  const sessionKey = cookieSessionKey ?? getSessionKeyFromUser(user.id);
  if (featuredHomes.length && sessionKey) {
    try {
      await logPropertyEventsBulk({
        supabase: context.supabase,
        propertyIds: featuredHomes.map((property) => property.id).filter(isUuid),
        eventType: "featured_impression",
        actorUserId: user.id,
        actorRole: role,
        sessionKey,
        meta: { source: "tenant_home" },
      });
    } catch (err) {
      console.warn("[tenant-home] featured impressions failed", err);
    }
  }

  const modules = buildTenantDiscoveryModules({ featuredHomes, popularHomes, newHomes });
  const hasSocialProofModules =
    trendingHomes.length > 0 || mostSavedHomes.length > 0 || mostViewedHomes.length > 0;
  const hasDiscoveryModules =
    modules.hasModules || hasSocialProofModules || shortletHomes.length > 0;

  let fallbackHomes: Property[] = [];
  if (!hasDiscoveryModules) {
    fallbackHomes = await getFallbackHomes({ limit: 9, context });
  }

  const allHomes = [
    ...featuredHomes,
    ...trendingHomes,
    ...mostSavedHomes,
    ...mostViewedHomes,
    ...shortletHomes,
    ...popularHomes,
    ...newHomes,
    ...fallbackHomes,
    ...savedHomes,
  ];
  const savedIds = await fetchSavedPropertyIds({
    supabase: context.supabase,
    userId: user.id,
    propertyIds: allHomes.map((property) => property.id),
  });
  let fastResponderByHost: Record<string, boolean> = {};
  let trustSnapshots: Record<string, TrustMarkerState> = {};
  let socialProofByListing: Record<string, ListingPopularitySignal> = {};
  try {
    const ownerIds = Array.from(
      new Set(allHomes.map((property) => property.owner_id).filter(Boolean))
    );
    if (ownerIds.length) {
      fastResponderByHost = await getFastResponderByHostIds({
        supabase: context.supabase,
        hostIds: ownerIds,
      });
      trustSnapshots = await fetchTrustPublicSnapshots(context.supabase, ownerIds);
    }
    const listingIds = Array.from(new Set(allHomes.map((property) => property.id).filter(Boolean)));
    if (listingIds.length) {
      socialProofByListing = await getListingPopularitySignals({
        client: context.supabase,
        listingIds,
      });
    }
  } catch (err) {
    console.warn("[tenant-home] fast responder lookup failed", err);
    fastResponderByHost = {};
    trustSnapshots = {};
    socialProofByListing = {};
  }

  if (DEV_MOCKS) {
    if (featuredListingsEnabled && !featuredHomes.length) {
      featuredHomes.push(...mockProperties.slice(0, 4));
    }
    if (!popularHomes.length) {
      popularHomes.push(...mockProperties.slice(1, 5));
    }
    if (!newHomes.length) {
      newHomes.push(...mockProperties.slice(2, 6));
    }
    if (!fallbackHomes.length && !modules.hasModules) {
      fallbackHomes = mockProperties.slice(0, 6);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-10 text-white shadow-xl md:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.35),transparent_40%),radial-gradient(circle_at_80%_0,rgba(56,189,248,0.25),transparent_30%)]" />
        <div className="relative grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
              Tenant Home
            </p>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
              Find your next home
            </h1>
            <p className="text-base text-slate-200">
              Search by city, area, or landmark. Save what you like and pick up the conversation when you’re ready.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
              <span className="rounded-full bg-white/10 px-3 py-1">Verified hosts</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Secure messaging</span>
              <span className="rounded-full bg-white/10 px-3 py-1">Saved search alerts</span>
            </div>
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

      <ContinueSearchCard />

      <section className="rounded-2xl border border-sky-100 bg-sky-50/70 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-700">Shortlet stays</p>
            <h2 className="text-xl font-semibold text-slate-900">Need a nightly stay?</h2>
            <p className="text-sm text-slate-600">
              Open the shortlet browse to filter bookable stays with date and pricing breakdown.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/properties?stay=shortlet">
              <Button>Browse shortlets</Button>
            </Link>
            <Link href="/trips">
              <Button variant="secondary">My trips</Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <HelpDrawerTrigger label="Need help?" testId="tenant-help-trigger" />
      </div>

      <NextBestActionsPanel role="tenant" items={gettingStartedChecklist} />

      <RoleChecklistPanel
        title="Getting started checklist"
        subtitle="Complete a few core actions to get faster matches and better response rates."
        items={gettingStartedChecklist}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              New matches for your saved searches
            </h2>
            <p className="text-sm text-slate-600">
              Track fresh listings that match searches you follow.
            </p>
          </div>
          <Link href="/saved-searches" className="text-sm font-semibold text-sky-700">
            Manage saved searches
          </Link>
        </div>
        <p className="mt-3 text-sm text-slate-700">
          {savedSearchSummary.totalNewMatches > 0
            ? `${savedSearchSummary.totalNewMatches} new matches across your followed searches.`
            : "No new matches yet. Follow a search from Browse to get updates here."}
        </p>
        {savedSearchSummary.searches.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {savedSearchSummary.searches.slice(0, 3).map((search) => (
              <div
                key={search.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <p className="text-sm font-semibold text-slate-900">{search.name}</p>
                <p className="text-xs text-slate-600">{search.newMatchesCount} new matches</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {savedHomes.length > 0 && (
        <section className="space-y-4" data-testid="tenant-home-saved">
          <SectionHeader
            title="Saved homes"
            description="Pick up your favourites and keep the conversation going."
            href="/tenant/saved"
            hrefLabel="View saved"
          />
          <PropertyRow
            items={savedHomes}
            testId="tenant-home-saved-row"
            savedIds={savedIds}
            fastResponderByHost={fastResponderByHost}
            trustSnapshots={trustSnapshots}
            socialProofByListing={socialProofByListing}
          />
        </section>
      )}

      {modules.hasFeatured && (
        <section className="space-y-4" data-testid="tenant-home-featured">
          <SectionHeader
            title="Featured homes"
            description="Premium placement from verified hosts and agents."
            href="/properties?featured=true"
          />
          <PropertyRow
            items={featuredHomes}
            testId="tenant-home-featured-row"
            savedIds={savedIds}
            fastResponderByHost={fastResponderByHost}
            trustSnapshots={trustSnapshots}
            socialProofByListing={socialProofByListing}
            source="featured"
          />
        </section>
      )}

      {trendingHomes.length > 0 && (
        <section className="space-y-4" data-testid="tenant-home-trending">
          <SectionHeader
            title="Trending this week"
            description={`Popular with renters in ${marketRegionLabel} and beyond, based on recent views and saves.`}
            href="/help/trending"
            hrefLabel="What is this?"
          />
          <PropertyRow
            items={trendingHomes}
            testId="tenant-home-trending-row"
            savedIds={savedIds}
            fastResponderByHost={fastResponderByHost}
            trustSnapshots={trustSnapshots}
            socialProofByListing={socialProofByListing}
          />
        </section>
      )}

      {mostSavedHomes.length > 0 && (
        <section className="space-y-4" data-testid="tenant-home-most-saved">
          <SectionHeader
            title="Most saved"
            description={`Homes with strong shortlist activity in ${marketRegionLabel} and beyond.`}
            href="/properties"
            hrefLabel="Browse all"
          />
          <PropertyRow
            items={mostSavedHomes}
            testId="tenant-home-most-saved-row"
            savedIds={savedIds}
            fastResponderByHost={fastResponderByHost}
            trustSnapshots={trustSnapshots}
            socialProofByListing={socialProofByListing}
          />
        </section>
      )}

      {mostViewedHomes.length > 0 && (
        <section className="space-y-4" data-testid="tenant-home-most-viewed">
          <SectionHeader
            title="Most viewed"
            description={`Homes drawing the highest viewing activity across ${marketRegionLabel} and beyond.`}
            href="/properties"
            hrefLabel="Browse all"
          />
          <PropertyRow
            items={mostViewedHomes}
            testId="tenant-home-most-viewed-row"
            savedIds={savedIds}
            fastResponderByHost={fastResponderByHost}
            trustSnapshots={trustSnapshots}
            socialProofByListing={socialProofByListing}
          />
        </section>
      )}

      {shortletHomes.length > 0 && (
        <section className="space-y-4" data-testid="tenant-home-shortlets">
          <SectionHeader
            title="Shortlets to book"
            description="Book stays by the night - Lagos and beyond."
            href="/properties?stay=shortlet"
            hrefLabel="Browse shortlets"
          />
          <PropertyRow
            items={shortletHomes}
            testId="tenant-home-shortlets-row"
            savedIds={savedIds}
            fastResponderByHost={fastResponderByHost}
            trustSnapshots={trustSnapshots}
            socialProofByListing={socialProofByListing}
            source="shortlets"
          />
        </section>
      )}

      {modules.hasPopular && (
        <section className="space-y-4" data-testid="tenant-home-popular">
          <SectionHeader
            title={popularHeading}
            description={
              popularCity
                ? `Homes tenants are engaging with right now, with ${popularCity} as a top starting point.`
                : "Homes tenants are engaging with right now."
            }
            href={popularCity ? `/properties?city=${encodeURIComponent(popularCity)}` : "/properties"}
          />
          <PropertyRow
            items={popularHomes}
            testId="tenant-home-popular-row"
            savedIds={savedIds}
            fastResponderByHost={fastResponderByHost}
            trustSnapshots={trustSnapshots}
            socialProofByListing={socialProofByListing}
          />
        </section>
      )}

      {modules.hasNew && (
        <section className="space-y-4" data-testid="tenant-home-new">
          <SectionHeader
            title={newThisWeekHeading}
            description={`Fresh listings added in the last 7 days across ${marketRegionLabel}.`}
            href="/properties?recent=7"
          />
          <PropertyRow
            items={newHomes}
            testId="tenant-home-new-row"
            savedIds={savedIds}
            fastResponderByHost={fastResponderByHost}
            trustSnapshots={trustSnapshots}
            socialProofByListing={socialProofByListing}
          />
        </section>
      )}

      {hubsForDisplay.length > 0 && (
        <section className="space-y-4" data-testid="tenant-home-cities">
          <SectionHeader
            title="Popular cities"
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
      )}

      {!hasDiscoveryModules && (
        <section className="space-y-4" data-testid="tenant-home-fallback">
          <SectionHeader
            title="Browse all homes"
            description="No featured modules yet — explore everything available."
            href="/properties"
          />
          {fallbackHomes.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" data-testid="tenant-home-fallback-grid">
              {fallbackHomes.map((property) => (
                <div key={property.id} data-testid="tenant-home-card">
                  <PropertyCard
                    property={property}
                    href={`/properties/${property.id}`}
                    showSave
                    initialSaved={savedIds.has(property.id)}
                    showCta
                    viewerRole="tenant"
                    fastResponder={fastResponderByHost[property.owner_id]}
                    trustMarkers={trustSnapshots[property.owner_id]}
                    socialProof={socialProofByListing[property.id] ?? null}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <h3 className="text-lg font-semibold text-slate-900">Check back soon</h3>
              <p className="mt-2 text-sm text-slate-600">
                We’re still onboarding listings in your area. Save a search and we’ll notify you when new homes go live.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Link href="/properties">
                  <Button variant="secondary">Browse listings</Button>
                </Link>
                <Link href="/tenant/saved-searches">
                  <Button>Save a search</Button>
                </Link>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
