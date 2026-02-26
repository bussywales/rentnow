export const dynamic = "force-dynamic";

import Link from "next/link";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyMapToggle } from "@/components/properties/PropertyMapToggle";
import { SmartSearchBox } from "@/components/properties/SmartSearchBox";
import { QuickSearchForm } from "@/components/search/QuickSearchForm";
import { HomeCollapsibleSection } from "@/components/home/HomeCollapsibleSection";
import { HomeListingRail } from "@/components/home/HomeListingRail";
import { MobileFeaturedDiscoveryStrip } from "@/components/home/MobileFeaturedDiscoveryStrip";
import { MobileQuickStartBar } from "@/components/home/MobileQuickStartBar";
import { MobileRecentlyViewedRail } from "@/components/home/MobileRecentlyViewedRail";
import { MobileRecommendedNextRail } from "@/components/home/MobileRecommendedNextRail";
import { MobileSavedRail } from "@/components/home/MobileSavedRail";
import { Button } from "@/components/ui/Button";
import { getProfile } from "@/lib/auth";
import { DEV_MOCKS, getApiBaseUrl } from "@/lib/env";
import { normalizeRole } from "@/lib/roles";
import { getListingCta } from "@/lib/role-access";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { mockProperties } from "@/lib/mock";
import type { Property } from "@/lib/types";
import { fetchSavedPropertyIds } from "@/lib/saved-properties.server";
import { fetchTrustPublicSnapshots } from "@/lib/trust-public";
import type { TrustMarkerState } from "@/lib/trust-markers";
import { getListingPopularitySignals, type ListingPopularitySignal } from "@/lib/properties/popularity.server";

const HOME_MOBILE_WHY_COLLAPSED_KEY = "home:public:why-propatyhub:collapsed:v1";

export default async function Home() {
  let featured: Property[] = [];
  let popularHomes: Property[] = [];
  let newHomes: Property[] = [];
  const apiBaseUrl = await getApiBaseUrl();
  const featuredApiUrl = `${apiBaseUrl}/api/properties/search?featured=true&pageSize=10`;
  const popularApiUrl = `${apiBaseUrl}/api/properties/search?pageSize=10`;
  const newHomesApiUrl = `${apiBaseUrl}/api/properties/search?recent=7&pageSize=10`;
  const supabaseReady = hasServerSupabaseEnv();
  let role = null;
  let profileId: string | null = null;

  if (supabaseReady) {
    const profile = await getProfile();
    role = normalizeRole(profile?.role);
    profileId = profile?.id ?? null;
  }
  const listingCta = getListingCta(role);

  if (supabaseReady) {
    try {
      const [featuredRes, popularRes, newHomesRes] = await Promise.all([
        fetch(featuredApiUrl, { cache: "no-store" }),
        fetch(popularApiUrl, { cache: "no-store" }),
        fetch(newHomesApiUrl, { cache: "no-store" }),
      ]);

      if (featuredRes.ok) {
        const json = await featuredRes.json();
        featured = ((json.properties as Property[]) || []).slice(0, 10);
      } else {
        console.warn("[home] featured listings request failed", featuredRes.status);
      }

      if (popularRes.ok) {
        const json = await popularRes.json();
        popularHomes = ((json.properties as Property[]) || []).slice(0, 10);
      } else {
        console.warn("[home] popular listings request failed", popularRes.status);
      }

      if (newHomesRes.ok) {
        const json = await newHomesRes.json();
        newHomes = ((json.properties as Property[]) || []).slice(0, 10);
      } else {
        console.warn("[home] new listings request failed", newHomesRes.status);
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

  const featuredPreview = featured.slice(0, 3);

  let savedIds = new Set<string>();
  let trustSnapshots: Record<string, TrustMarkerState> = {};
  let socialProofByListing: Record<string, ListingPopularitySignal> = {};
  if (supabaseReady && profileId && featuredPreview.length) {
    try {
      const supabase = await createServerSupabaseClient();
      savedIds = await fetchSavedPropertyIds({
        supabase,
        userId: profileId,
        propertyIds: featuredPreview.map((property) => property.id),
      });
      const ownerIds = Array.from(new Set(featuredPreview.map((property) => property.owner_id).filter(Boolean)));
      if (ownerIds.length) {
        trustSnapshots = await fetchTrustPublicSnapshots(supabase, ownerIds);
      }
      socialProofByListing = await getListingPopularitySignals({
        client: supabase,
        listingIds: featuredPreview.map((property) => property.id),
      });
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
      if (ownerIds.length) {
        trustSnapshots = await fetchTrustPublicSnapshots(supabase, ownerIds);
      }
      socialProofByListing = await getListingPopularitySignals({
        client: supabase,
        listingIds: featuredPreview.map((property) => property.id),
      });
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
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4">
      <MobileQuickStartBar />
      <section className="space-y-4 md:hidden" data-testid="mobile-home-inventory-first">
        <MobileFeaturedDiscoveryStrip />
        <MobileRecentlyViewedRail />
        <MobileSavedRail />
        <MobileRecommendedNextRail />
        {featured.length ? (
          <HomeListingRail
            title="Featured homes"
            subtitle="Homes to shortlist now"
            listings={featured.slice(0, 6)}
            source="home_mobile_featured"
            sectionTestId="mobile-home-featured-rail"
            href="/properties?featured=true"
            hrefLabel="See all"
          />
        ) : null}
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

      <section className="relative hidden overflow-hidden rounded-3xl bg-slate-900 px-6 py-12 text-white shadow-xl md:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.3),transparent_35%),radial-gradient(circle_at_80%_0,rgba(56,189,248,0.25),transparent_25%)]" />
        <div className="relative grid items-center gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
              PropatyHub Beta
            </p>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              Find the right place — faster and with confidence.
            </h1>
            <p className="text-lg text-slate-200">
              Rent or buy homes across Africa and beyond. Search by city, budget, or simply describe what you need.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/auth/register">
                <Button>Get started</Button>
              </Link>
              <Link href="/properties">
                <Button variant="secondary">Browse properties</Button>
              </Link>
            </div>
          </div>
          <div className="glass relative rounded-2xl p-5 text-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Quick search
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  Find your next stay
                </p>
              </div>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                PWA ready
              </span>
            </div>
            <QuickSearchForm />
          </div>
        </div>
      </section>

      <section className="hidden gap-4 md:grid md:grid-cols-3">
        {hubs.map((hub) => (
          <div
            key={hub.city}
            className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Featured hub
            </p>
            <p className="text-xl font-semibold text-slate-900">{hub.city}</p>
            <p className="text-sm text-slate-600">{hub.caption}</p>
            <Link
              href={`/properties?city=${encodeURIComponent(hub.city)}`}
              className="mt-3 inline-flex text-sm font-semibold text-sky-700"
            >
              Browse {hub.city}
            </Link>
          </div>
        ))}
      </section>

      <section className="hidden gap-6 md:grid md:grid-cols-5">
        <div className="md:col-span-3">
          <SmartSearchBox />
        </div>
        <div className="md:col-span-2 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">How it works</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>1. Browse verified listings across cities and neighbourhoods.</li>
            <li>2. Save and compare homes that fit your lifestyle and budget.</li>
            <li>3. Message securely — no spam, no pressure.</li>
            <li>4. Book viewings or connect when you’re ready.</li>
          </ul>
          <div className="rounded-xl bg-slate-900 px-4 py-3 text-sm text-slate-100">
            <p className="font-semibold text-white">Built for trust</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-100/90">
              <li>• Verified hosts and agents</li>
              <li>• Secure in-app messaging</li>
              <li>• Admin-reviewed listings</li>
              <li>• No hidden fees or forced contact</li>
            </ul>
          </div>
        </div>
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
