import Link from "next/link";
import { Button } from "@/components/ui/Button";

type CollectionHeroProps = {
  title: string;
  description: string;
  marketCountry: string;
  viewResultsHref: string;
};

export function CollectionHero({
  title,
  description,
  marketCountry,
  viewResultsHref,
}: CollectionHeroProps) {
  return (
    <header
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      data-testid="collections-hero"
    >
      <div className="bg-gradient-to-br from-slate-900 via-sky-800 to-slate-700 p-6 text-white">
        <p className="text-xs uppercase tracking-[0.2em] text-white/80">Collections</p>
        <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-white/90">{description}</p>
        <p className="mt-2 text-xs text-white/80">Market-aware picks for {marketCountry}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-6 py-3">
        <Link href={viewResultsHref}>
          <Button data-testid="collections-view-results-cta">View results</Button>
        </Link>
        <Link href="/collections">
          <Button variant="secondary">All collections</Button>
        </Link>
      </div>
    </header>
  );
}

