import Link from "next/link";
import type { SavedSearch } from "@/lib/types";

type SavedSearchPreviewProps = {
  searches: SavedSearch[];
};

function formatSummary(search: SavedSearch) {
  const params = search.query_params || {};
  const parts: string[] = [];
  if (typeof params.city === "string") parts.push(params.city);
  if (typeof params.rentalType === "string") {
    parts.push(params.rentalType === "short_let" ? "Short-let" : "Long-term");
  }
  if (typeof params.bedrooms === "number") parts.push(`${params.bedrooms}+ beds`);
  if (typeof params.minPrice === "number" || typeof params.maxPrice === "number") {
    parts.push(`Price ${params.minPrice ?? "min"}-${params.maxPrice ?? "max"}`);
  }
  return parts.length ? parts.join(" - ") : "All listings";
}

export function SavedSearchPreview({ searches }: SavedSearchPreviewProps) {
  const limited = searches.slice(0, 3);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Saved searches</p>
        <Link href="/dashboard/saved-searches" className="text-xs font-semibold text-sky-700">
          Manage
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {!limited.length && (
          <div className="rounded-xl bg-slate-50/80 px-4 py-6 text-center ring-1 ring-dashed ring-slate-200/70">
            <p className="text-sm font-semibold text-slate-900">
              Save a search to get alerts when new homes match your needs.
            </p>
            <Link
              href="/properties"
              className="mt-3 inline-flex text-sm font-semibold text-sky-700 transition hover:text-sky-800"
            >
              Create saved search
            </Link>
          </div>
        )}
        {limited.map((search) => (
          <div
            key={search.id}
            className="rounded-xl bg-slate-50/80 px-4 py-3 ring-1 ring-slate-200/60"
          >
            <p className="text-sm font-semibold text-slate-900">{search.name}</p>
            <p className="text-xs text-slate-600">{formatSummary(search)}</p>
            <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-slate-600">
              <Link
                href={`/dashboard/saved-searches?edit=${search.id}`}
                className="transition hover:text-slate-800"
              >
                Edit
              </Link>
              <Link
                href={`/dashboard/saved-searches?pause=${search.id}`}
                className="transition hover:text-slate-800"
              >
                Pause
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
