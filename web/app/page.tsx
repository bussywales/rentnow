export const dynamic = "force-dynamic";

import Link from "next/link";
import { HeroSearchForm } from "@/components/home/HeroSearchForm";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyMapToggle } from "@/components/properties/PropertyMapToggle";
import { SmartSearchBox } from "@/components/properties/SmartSearchBox";
import { HomeCollapsibleSection } from "@/components/home/HomeCollapsibleSection";
import { HomeListingRail } from "@/components/home/HomeListingRail";
import { MobileFeaturedDiscoveryStrip } from "@/components/home/MobileFeaturedDiscoveryStrip";
import { MobileQuickStartBar } from "@/components/home/MobileQuickStartBar";
import { MobileRecentlyViewedRail } from "@/components/home/MobileRecentlyViewedRail";
import { MobileRecommendedNextRail } from "@/components/home/MobileRecommendedNextRail";
import { MobileSavedRail } from "@/components/home/MobileSavedRail";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { getProfile } from "@/lib/auth";
import { DEV_MOCKS } from "@/lib/env";
import { normalizeRole } from "@/lib/roles";
import { getListingCta } from "@/lib/role-access";
import { searchProperties } from "@/lib/search";
import { parseFiltersFromSearchParams } from "@/lib/search-filters";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { mockProperties } from "@/lib/mock";
import type { Property } from "@/lib/types";
import { fetchSavedPropertyIds } from "@/lib/saved-properties.server";
import { fetchTrustPublicSnapshots } from "@/lib/trust-public";
import type { TrustMarkerState } from "@/lib/trust-markers";
import { getListingPopularitySignals, type ListingPopularitySignal } from "@/lib/properties/popularity.server";
import { isExploreEnabled } from "@/lib/settings/explore";
import { includeDemoListingsForViewerFromSettings } from "@/lib/settings/demo";
import { getPropertyRequestQuickStartEntry } from "@/lib/requests/property-request-entry";

const HOME_MOBILE_WHY_COLLAPSED_KEY = "home:public:why-propatyhub:collapsed:v1";

function getSignedInHeroCta(role: ReturnType<typeof normalizeRole>) {
  if (role === "tenant") {
    return { label: "Open your home", href: "/tenant/home" } as const;
  }
  if (role === "admin") {
    return { label: "Open admin", href: "/admin" } as const;
  }
  if (role === "landlord" || role === "agent") {
    return { label: "Go to workspace", href: "/home" } as const;
  }
  return null;
}

export default async function Home() {
  let featured: Property[] = [];
  let popularHomes: Property[] = [];
  let newHomes: Property[] = [];
  const supabaseReady = hasServerSupabaseEnv();
  const profilePromise = supabaseReady ? getProfile() : Promise.resolve(null);
  const [profile, exploreEnabled] = await Promise.all([profilePromise, isExploreEnabled()]);
  const role = normalizeRole(profile?.role);
  let profileId: string | null = null;

  if (supabaseReady) profileId = profile?.id ?? null;
  const listingCta = getListingCta(role);
  const requestQuickStartEntry = getPropertyRequestQuickStartEntry(role);
  const signedInHeroCta = getSignedInHeroCta(role);

  if (supabaseReady) {
    try {
      const baseFilters = parseFiltersFromSearchParams(new URLSearchParams());
      const includeDemoListings = await includeDemoListingsForViewerFromSettings({
        viewerRole: role,
      });
      const [featuredResult, popularResult, newHomesResult] = await Promise.all([
        searchProperties(baseFilters, {
          page: 1,
          pageSize: 10,
          featuredOnly: true,
          includeDemo: includeDemoListings,
        }),
        searchProperties(baseFilters, {
          page: 1,
          pageSize: 10,
          includeDemo: includeDemoListings,
        }),
        searchProperties(baseFilters, {
          page: 1,
          pageSize: 10,
          recentDays: 7,
          includeDemo: includeDemoListings,
        }),
      ]);

      if (featuredResult.error) {
        console.warn("[home] featured listings request failed", featuredResult.error.message);
      } else {
        featured = ((featuredResult.data as Property[]) || []).slice(0, 10);
      }

      if (popularResult.error) {
        console.warn("[home] popular listings request failed", popularResult.error.message);
      } else {
        popularHomes = ((popularResult.data as Property[]) || []).slice(0, 10);
      }

      if (newHomesResult.error) {
        console.warn("[home] new listings request failed", newHomesResult.error.message);
      } else {
        newHomes = ((newHomesResult.data as Property[]) || []).slice(0, 10);
      }
    } catch (err) {
      console.warn("[home] unable to fetch listing rails", err);
    }
  }

  if (DEV_MOCKS && (!supabaseReady || (!featured.length && !popularHomes.length && !newHomes.length))) {
    featured = mockProperties.slice(0, 6);
    popularHomes = mockProperties.slice(2, 8);
    newHomes = mockProperties.slice(1, 7);
  }

  const featuredRailMode = featured.length
    ? "featured"
    : popularHomes.length
      ? "popular"
      : newHomes.length
        ? "new"
        : "none";
  const featuredRailListings =
    featuredRailMode === "featured"
      ? featured
      : featuredRailMode === "popular"
        ? popularHomes
        : featuredRailMode === "new"
          ? newHomes
          : [];
  const featuredRailSubtitle =
    featuredRailMode === "featured"
      ? "Homes to shortlist now"
      : featuredRailMode === "popular"
        ? "Trending stays to shortlist now"
        : "Fresh listings to shortlist now";
  const featuredRailHref =
    featuredRailMode === "popular"
      ? "/properties"
      : featuredRailMode === "new"
        ? "/properties?recent=7"
        : "/properties?featured=true";
  const featuredRailSource =
    featuredRailMode === "featured" ? "home_mobile_featured" : `home_mobile_featured_fallback_${featuredRailMode}`;

  const featuredPreview = featured.slice(0, 3);

  let savedIds = new Set<string>();
  let trustSnapshots: Record<string, TrustMarkerState> = {};
  let socialProofByListing: Record<string, ListingPopularitySignal> = {};
  if (supabaseReady && profileId && featuredPreview.length) {
    try {
      const supabase = await createServerSupabaseClient();
      const ownerIds = Array.from(new Set(featuredPreview.map((property) => property.owner_id).filter(Boolean)));
      const [nextSavedIds, nextTrustSnapshots, nextSocialProof] = await Promise.all([
        fetchSavedPropertyIds({
          supabase,
          userId: profileId,
          propertyIds: featuredPreview.map((property) => property.id),
        }),
        ownerIds.length
          ? fetchTrustPublicSnapshots(supabase, ownerIds)
          : Promise.resolve({} as Record<string, TrustMarkerState>),
        getListingPopularitySignals({
          client: supabase,
          listingIds: featuredPreview.map((property) => property.id),
        }),
      ]);
      savedIds = nextSavedIds;
      trustSnapshots = nextTrustSnapshots;
      socialProofByListing = nextSocialProof;
    } catch (err) {
      console.warn("[home] saved property lookup failed", err);
      savedIds = new Set<string>();
      trustSnapshots = {};
      socialProofByListing = {};
    }
  }
  if (supabaseReady && !profileId && featuredPreview.length) {
    try {
      const supabase = await createServerSupabaseClient();
      const ownerIds = Array.from(new Set(featuredPreview.map((property) => property.owner_id).filter(Boolean)));
      const [nextTrustSnapshots, nextSocialProof] = await Promise.all([
        ownerIds.length
          ? fetchTrustPublicSnapshots(supabase, ownerIds)
          : Promise.resolve({} as Record<string, TrustMarkerState>),
        getListingPopularitySignals({
          client: supabase,
          listingIds: featuredPreview.map((property) => property.id),
        }),
      ]);
      trustSnapshots = nextTrustSnapshots;
      socialProofByListing = nextSocialProof;
    } catch (err) {
      console.warn("[home] trust signal lookup failed", err);
      trustSnapshots = {};
      socialProofByListing = {};
    }
  }

  const hubs = [
    { city: "Lagos", caption: "Island - Ikoyi - Lekki" },
    { city: "Nairobi", caption: "Kilimani - Westlands" },
    { city: "Accra", caption: "East Legon - Airport" },
  ];

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 pb-8 lg:gap-14 xl:px-6">
      <MobileQuickStartBar
        showExploreChip={exploreEnabled}
        requestAction={requestQuickStartEntry}
      />
      <section className="space-y-4 md:hidden" data-testid="mobile-home-inventory-first">
        {featuredRailListings.length ? (
          <HomeListingRail
            title="Featured homes"
            subtitle={featuredRailSubtitle}
            listings={featuredRailListings.slice(0, 6)}
            source={featuredRailSource}
            sectionTestId="mobile-home-featured-rail"
            href={featuredRailHref}
            hrefLabel="See all"
          />
        ) : null}
        <MobileFeaturedDiscoveryStrip />
        <MobileRecommendedNextRail />
        <MobileRecentlyViewedRail />
        <MobileSavedRail />
        <div data-testid="mobile-home-smart-search-compact">
          <SmartSearchBox compact />
        </div>
        {popularHomes.length ? (
          <HomeListingRail
            title="Popular in market"
            subtitle="Homes people are viewing now"
            listings={popularHomes.slice(0, 6)}
            source="home_mobile_popular"
            sectionTestId="mobile-home-popular-rail"
            href="/properties"
            hrefLabel="See all"
          />
        ) : null}
        {newHomes.length ? (
          <HomeListingRail
            title="New this week"
            subtitle="Fresh listings just added"
            listings={newHomes.slice(0, 6)}
            source="home_mobile_new"
            sectionTestId="mobile-home-new-rail"
            href="/properties?recent=7"
            hrefLabel="See all"
          />
        ) : null}
        <HomeCollapsibleSection
          title="Why PropatyHub?"
          description="How we keep discovery fast and trustworthy."
          storageKey={HOME_MOBILE_WHY_COLLAPSED_KEY}
          defaultCollapsed
          testId="mobile-home-why-propatyhub"
        >
          <div className="space-y-3">
            <ul className="space-y-1.5 text-sm text-slate-600">
              <li>1. Browse verified listings across cities and neighbourhoods.</li>
              <li>2. Save and compare homes that fit your lifestyle and budget.</li>
              <li>3. Message securely — no spam, no pressure.</li>
              <li>4. Book viewings or connect when you’re ready.</li>
            </ul>
            <div className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs text-slate-100">
              <p className="font-semibold text-white">Built for trust</p>
              <ul className="mt-1.5 space-y-1 text-slate-100/90">
                <li>• Verified hosts and agents</li>
                <li>• Secure in-app messaging</li>
                <li>• Admin-reviewed listings</li>
                <li>• No hidden fees or forced contact</li>
              </ul>
            </div>
          </div>
        </HomeCollapsibleSection>
      </section>

      <section
        className="relative hidden overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-10 text-white shadow-[0_32px_90px_rgba(15,23,42,0.22)] md:block xl:px-10 xl:py-12"
        data-testid="desktop-home-hero"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(56,189,248,0.22),transparent_30%),radial-gradient(circle_at_88%_14%,rgba(37,99,235,0.18),transparent_24%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(15,23,42,0.88)_52%,rgba(9,18,37,0.95))]" />
        <div className="absolute inset-y-0 right-[34%] hidden w-px bg-white/10 xl:block" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(400px,460px)] lg:gap-10 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,470px)] xl:gap-12">
          <div className="flex min-h-[440px] flex-col justify-between">
            <div className="space-y-5">
              <div className="space-y-4">
                <h1 className="max-w-[10ch] text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-white lg:text-[4.25rem] xl:text-[4.7rem]">
                  Find the right place with less friction.
                </h1>
                <p className="max-w-xl text-lg leading-8 text-slate-200">
                  Rent, buy, or book a short stay in one place, then move straight into the search flow that fits your market and intent.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <ButtonLink href="/properties" data-testid="desktop-home-cta-browse">
                  Browse homes
                </ButtonLink>
                {requestQuickStartEntry ? (
                  <ButtonLink
                    href={requestQuickStartEntry.href}
                    variant="secondary"
                    data-testid="desktop-home-cta-request"
                  >
                    {requestQuickStartEntry.label}
                  </ButtonLink>
                ) : null}
                {signedInHeroCta ? (
                  <Link
                    href={signedInHeroCta.href}
                    data-testid="desktop-home-cta-signed-in"
                    className="text-sm font-semibold text-cyan-100 underline-offset-4 hover:text-white hover:underline"
                  >
                    {signedInHeroCta.label}
                  </Link>
                ) : (
                  <Link
                    href="/auth/register"
                    data-testid="desktop-home-cta-get-started"
                    className="text-sm font-semibold text-cyan-100 underline-offset-4 hover:text-white hover:underline"
                  >
                    Get started
                  </Link>
                )}
              </div>
            </div>
            <div className="grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-2 xl:max-w-[620px] xl:grid-cols-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                  One front door
                </p>
                <p className="text-sm text-slate-200">Switch cleanly between renting, buying, and short stays.</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                  Market-aware
                </p>
                <p className="text-sm text-slate-200">Open the right browse path instead of forcing one generic search.</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                  Trust-led
                </p>
                <p className="text-sm text-slate-200">Verified listings, saved searches, and clearer next steps from the start.</p>
              </div>
            </div>
          </div>
          <div className="relative lg:ml-auto lg:w-full lg:max-w-[470px]">
            <div className="absolute inset-0 rounded-[2rem] bg-white/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-white/94 p-5 shadow-[0_32px_90px_rgba(15,23,42,0.34)] backdrop-blur xl:p-6">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/80 to-transparent" />
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Hero search
                  </p>
                  <div>
                    <p className="text-[1.9rem] font-semibold tracking-[-0.03em] text-slate-950">
                      Search homes the right way
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Intent first, filters tight, and the right discovery flow immediately.
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">
                  Rent • Buy • Shortlets
                </span>
              </div>
              <HeroSearchForm />
            </div>
          </div>
        </div>
      </section>

      <section className="hidden gap-4 md:grid md:grid-cols-3" data-testid="desktop-home-market-hubs">
        {hubs.map((hub) => (
          <div
            key={hub.city}
            className="rounded-[1.5rem] border border-slate-200/80 bg-white/78 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.09)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Popular market
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-slate-900">{hub.city}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{hub.caption}</p>
            <Link
              href={`/properties?city=${encodeURIComponent(hub.city)}`}
              className="mt-4 inline-flex text-sm font-semibold text-sky-700"
            >
              Browse {hub.city}
            </Link>
          </div>
        ))}
      </section>

      {featuredPreview.length ? (
        <section className="hidden space-y-4 md:block" data-testid="featured-homes-section">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Featured homes
              </h2>
              <p className="text-sm text-slate-600">
                Premium listings from verified advertisers
              </p>
            </div>
            <Link href={listingCta.href} className="text-sm font-semibold text-sky-600">
              {`${listingCta.label} ->`}
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {featuredPreview.map((property) => (
              <div key={property.id} data-testid="property-card">
                <PropertyCard
                  property={property}
                  href={`/properties/${property.id}`}
                  showSave
                  initialSaved={savedIds.has(property.id)}
                  showCta={!role || role === "tenant"}
                  viewerRole={role}
                  trustMarkers={trustSnapshots[property.owner_id]}
                  socialProof={socialProofByListing[property.id] ?? null}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section
        className="hidden items-start gap-8 rounded-[2rem] border border-slate-200/70 bg-white/68 px-6 py-7 shadow-[0_18px_45px_rgba(15,23,42,0.05)] md:grid md:grid-cols-[minmax(0,1.05fr)_320px]"
        data-testid="desktop-home-smart-search-assist"
      >
        <div className="space-y-4">
          <div className="max-w-2xl space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Search assist
            </p>
            <h2 className="text-[2rem] font-semibold tracking-[-0.03em] text-slate-900">
              Need a more specific brief?
            </h2>
            <p className="text-sm leading-7 text-slate-600">
              Use smart search when your request is more descriptive than structured. It’s a secondary assist, not the main way into discovery.
            </p>
          </div>
          <SmartSearchBox compact />
        </div>
        <div className="space-y-4 pt-1">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">How PropatyHub keeps search useful</h3>
            <ul className="space-y-2 text-sm leading-6 text-slate-600">
              <li>1. Start with intent so results match what you are actually trying to do.</li>
              <li>2. Refine on the results page with the deeper filters that already power the platform.</li>
              <li>3. Save, compare, message, and book viewings only when a listing is truly worth it.</li>
            </ul>
          </div>
          <div className="rounded-[1.4rem] bg-slate-950 px-4 py-4 text-sm text-slate-100">
            <p className="font-semibold text-white">Built for trust</p>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-100/88">
              <li>• Verified hosts and agents</li>
              <li>• Secure in-app messaging</li>
              <li>• Admin-reviewed listings</li>
              <li>• No hidden fees or forced contact</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="hidden space-y-4 md:block">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Map preview</h2>
          <Link href="/properties" className="text-sm font-semibold text-sky-600">
            {"Open full map ->"}
          </Link>
        </div>
        <PropertyMapToggle
          properties={featuredPreview}
          height="360px"
          title="Listings map"
          description="Explore listings on the map to discover the right neighbourhood."
          variant="inline"
          defaultOpen
        />
      </section>
    </div>
  );
}
