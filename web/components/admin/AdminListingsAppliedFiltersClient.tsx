"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { AdminListingsQuery } from "@/lib/admin/admin-listings-query";
import {
  DEFAULT_ADMIN_LISTINGS_QUERY,
  hasActiveAdminListingsFilters,
  serializeAdminListingsQuery,
} from "@/lib/admin/admin-listings-query";

type Chip = {
  key: string;
  label: string;
  onRemove: () => void;
};

type Props = {
  query: AdminListingsQuery;
  basePath?: string;
};

function buildUrl(basePath: string, query: AdminListingsQuery) {
  const params = serializeAdminListingsQuery(query);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export default function AdminListingsAppliedFiltersClient({
  query,
  basePath = "/admin/listings",
}: Props) {
  const router = useRouter();

  const chips = useMemo<Chip[]>(() => {
    const nextChips: Chip[] = [];
    const pushChip = (key: string, label: string, nextQuery: AdminListingsQuery) => {
      nextChips.push({
        key,
        label,
        onRemove: () => {
          const sanitized: AdminListingsQuery = { ...nextQuery, page: 1 };
          router.replace(buildUrl(basePath, sanitized), { scroll: false });
        },
      });
    };

    if (query.q) {
      pushChip(
        "q",
        `Search: ${query.q}`,
        { ...query, q: null, qMode: DEFAULT_ADMIN_LISTINGS_QUERY.qMode }
      );
    }

    if (query.statuses.length) {
      query.statuses.forEach((status) => {
        const remaining = query.statuses.filter((s) => s !== status);
        pushChip(
          `status:${status}`,
          `Status: ${status}`,
          { ...query, statuses: remaining }
        );
      });
    }

    if (query.active !== "all") {
      pushChip(
        "active",
        `Active: ${query.active === "true" ? "yes" : "no"}`,
        { ...query, active: DEFAULT_ADMIN_LISTINGS_QUERY.active }
      );
    }

    if (query.missingCover) {
      pushChip("missingCover", "Missing cover", { ...query, missingCover: false });
    }
    if (query.missingPhotos) {
      pushChip("missingPhotos", "Missing photos", { ...query, missingPhotos: false });
    }
    if (query.missingLocation) {
      pushChip("missingLocation", "Missing location", { ...query, missingLocation: false });
    }

    if (query.priceMin !== null || query.priceMax !== null) {
      const label = `Price: ${query.priceMin ?? "–"}–${query.priceMax ?? "–"}`;
      pushChip("price", label, { ...query, priceMin: null, priceMax: null });
    }

    if (query.listing_type) {
      pushChip("listing_type", `Type: ${query.listing_type}`, { ...query, listing_type: null });
    }

    if (query.bedroomsMin !== null || query.bedroomsMax !== null) {
      const label = `Beds: ${query.bedroomsMin ?? "–"}–${query.bedroomsMax ?? "–"}`;
      pushChip("beds", label, { ...query, bedroomsMin: null, bedroomsMax: null });
    }

    if (query.bathroomsMin !== null || query.bathroomsMax !== null) {
      const label = `Baths: ${query.bathroomsMin ?? "–"}–${query.bathroomsMax ?? "–"}`;
      pushChip("baths", label, { ...query, bathroomsMin: null, bathroomsMax: null });
    }

    return nextChips;
  }, [basePath, query, router]);

  if (!hasActiveAdminListingsFilters(query)) {
    return null;
  }

  return (
    <div
      data-testid="admin-listings-applied-filters"
      className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
    >
      <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
        Applied filters
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip.key}
            data-testid="admin-listings-filter-chip"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
          >
            {chip.label}
            <button
              type="button"
              onClick={chip.onRemove}
              className="rounded-full px-1 text-slate-500 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
              aria-label={`Remove ${chip.label}`}
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => router.replace(basePath, { scroll: false })}
          className="text-xs text-slate-600 underline"
        >
          Clear all
        </button>
      </div>
    </div>
  );
}
