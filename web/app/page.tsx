export const dynamic = "force-dynamic";

import Link from "next/link";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyMapToggle } from "@/components/properties/PropertyMapToggle";
import { SmartSearchBox } from "@/components/properties/SmartSearchBox";
import { QuickSearchForm } from "@/components/search/QuickSearchForm";
import { Button } from "@/components/ui/Button";
import { getProfile } from "@/lib/auth";
import { DEV_MOCKS, getApiBaseUrl } from "@/lib/env";
import { normalizeRole } from "@/lib/roles";
import { getListingCta } from "@/lib/role-access";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { mockProperties } from "@/lib/mock";
import type { Property } from "@/lib/types";
import { fetchSavedPropertyIds } from "@/lib/saved-properties.server";

export default async function Home() {
  let featured: Property[] = [];
  const apiBaseUrl = await getApiBaseUrl();
  const apiUrl = `${apiBaseUrl}/api/properties/search?featured=true&pageSize=6`;
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
      const res = await fetch(apiUrl, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        const typed = (json.properties as Property[]) || [];
        featured = typed.slice(0, 3) || [];
      } else {
        console.warn("[home] featured listings request failed", res.status);
      }
    } catch (err) {
      console.warn("[home] unable to fetch featured properties", err);
    }
  }

  if (DEV_MOCKS && (!supabaseReady || !featured.length)) {
    featured = mockProperties.slice(0, 3);
  }

  let savedIds = new Set<string>();
  if (supabaseReady && profileId && featured.length) {
    try {
      const supabase = await createServerSupabaseClient();
      savedIds = await fetchSavedPropertyIds({
        supabase,
        userId: profileId,
        propertyIds: featured.map((property) => property.id),
      });
    } catch (err) {
      console.warn("[home] saved property lookup failed", err);
      savedIds = new Set<string>();
    }
  }

  const hubs = [
    { city: "Lagos", caption: "Island - Ikoyi - Lekki" },
    { city: "Nairobi", caption: "Kilimani - Westlands" },
    { city: "Accra", caption: "East Legon - Airport" },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4">
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-12 text-white shadow-xl">
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

      <section className="grid gap-4 md:grid-cols-3">
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

      <section className="grid gap-6 md:grid-cols-5">
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

      {featured.length ? (
        <section className="space-y-4" data-testid="featured-homes-section">
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
            {featured.map((property) => (
              <div key={property.id} data-testid="property-card">
                <PropertyCard
                  property={property}
                  href={`/properties/${property.id}`}
                  showSave
                  initialSaved={savedIds.has(property.id)}
                  showCta={!role || role === "tenant"}
                  viewerRole={role}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Map preview</h2>
          <Link href="/properties" className="text-sm font-semibold text-sky-600">
            {"Open full map ->"}
          </Link>
        </div>
        <PropertyMapToggle
          properties={featured}
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
