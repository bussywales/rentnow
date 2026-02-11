import Link from "next/link";
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
  getNewHomes,
  getPopularHomes,
  getTenantDiscoveryContext,
  getSavedHomes,
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

function CityTiles({ cities }: { cities: ReturnType<typeof getCityCollections> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cities.map((city) => (
        <Link
          key={city.city}
          href={`/properties?city=${encodeURIComponent(city.city)}`}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Explore</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{city.city}</p>
          <p className="text-sm text-slate-600">{city.caption}</p>
        </Link>
      ))}
    </div>
  );
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

  const context = await getTenantDiscoveryContext();
  const cityCollections = getCityCollections();
  const fallbackCity = cityCollections[0]?.city ?? null;

  let jurisdictionCode = context.profileJurisdiction ?? null;
  if (!jurisdictionCode) {
    jurisdictionCode = await resolveJurisdiction({
      userId: user.id,
      supabase: context.supabase,
    });
  }

  const jurisdictionName = getCountryByCode(jurisdictionCode)?.name ?? jurisdictionCode;
  const popularCity =
    context.profileCity ??
    (jurisdictionCode ? DEFAULT_CITY_BY_JURISDICTION[jurisdictionCode] : null) ??
    fallbackCity;

  const popularHeading = popularCity
    ? `Popular in ${popularCity}`
    : jurisdictionName
      ? `Popular in ${jurisdictionName}`
      : "Popular homes";

  const [savedSearchSummary, featuredHomes, popularHomes, newHomes, savedHomes] = await Promise.all([
    getSavedSearchSummaryForUser({
      supabase: context.supabase,
      userId: user.id,
    }).catch(() => ({ totalNewMatches: 0, searches: [] })),
    getFeaturedHomes({ limit: MODULE_LIMIT, context }),
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

  let fallbackHomes: Property[] = [];
  if (!modules.hasModules) {
    fallbackHomes = await getFallbackHomes({ limit: 9, context });
  }

  const allHomes = [
    ...featuredHomes,
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
    if (!featuredHomes.length) {
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
          </div>
          <div className="rounded-2xl bg-white/95 p-4 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.3)]">
            <SmartSearchBox mode="browse" />
          </div>
        </div>
      </section>

      <ContinueSearchCard />

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

      {modules.hasPopular && (
        <section className="space-y-4" data-testid="tenant-home-popular">
          <SectionHeader
            title={popularHeading}
            description="Homes tenants are engaging with right now."
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
            title="New this week"
            description="Fresh listings added in the last 7 days."
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

      {cityCollections.length > 0 && (
        <section className="space-y-4" data-testid="tenant-home-cities">
          <SectionHeader
            title="Popular cities"
            description="Browse curated neighbourhoods and popular districts."
          />
          <CityTiles cities={cityCollections} />
        </section>
      )}

      {!modules.hasModules && (
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
