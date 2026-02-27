"use client";

import Link from "next/link";
import type { Property } from "@/lib/types";
import { ExploreSlide } from "@/components/explore/ExploreSlide";

type ExplorePagerProps = {
  listings: Property[];
};

export function ExplorePager({ listings }: ExplorePagerProps) {
  if (!listings.length) {
    return (
      <section
        className="mx-auto flex min-h-[60svh] max-w-lg flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm"
        data-testid="explore-empty"
      >
        <h1 className="text-xl font-semibold text-slate-900">Explore listings</h1>
        <p className="text-sm text-slate-600">
          We could not load the explore feed right now. Try browsing shortlets or properties.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/shortlets"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Browse shortlets
          </Link>
          <Link
            href="/properties"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Browse properties
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 shadow-sm" data-testid="explore-root">
      <div
        className="scrollbar-none h-[100svh] snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
        data-testid="explore-pager"
      >
        {listings.map((property, index) => (
          <ExploreSlide key={property.id} property={property} index={index} />
        ))}
      </div>
    </section>
  );
}
