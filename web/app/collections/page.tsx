import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { Button } from "@/components/ui/Button";
import { listCollectionsForMarket } from "@/lib/collections/collections-registry";
import { MARKET_COOKIE_NAME, resolveMarketFromRequest } from "@/lib/market/market";

export const metadata: Metadata = {
  title: "Collections · PropatyHub",
  description: "Shareable market-aware collections for shortlets and properties.",
};

export default async function CollectionsIndexPage() {
  const requestHeaders = await headers();
  const requestCookies = await cookies();
  const market = resolveMarketFromRequest({
    headers: requestHeaders,
    cookieValue: requestCookies.get(MARKET_COOKIE_NAME)?.value ?? null,
  });

  const collections = listCollectionsForMarket({
    marketCountry: market.country,
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-12 pt-5">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-900 via-sky-800 to-slate-700 p-6 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-white/80">Collections</p>
          <h1 className="mt-1 text-2xl font-semibold">Discover curated routes into listings</h1>
          <p className="mt-2 text-sm text-white/90">
            Browse shareable collection pages that adapt by market context.
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2" data-testid="collections-index-grid">
        {collections.map((collection) => (
          <article
            key={collection.slug}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Collection</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{collection.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{collection.description}</p>
            <div className="mt-3">
              <Link href={`/collections/${collection.slug}`}>
                <Button size="sm">Open collection</Button>
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

