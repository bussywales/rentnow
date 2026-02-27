"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import type { RecommendedNextItem } from "@/lib/reco";
import { buildRecommendedNextItems } from "@/lib/reco";
import { getLastSearchHref } from "@/lib/search/last-search";
import { getRecentSearches } from "@/lib/search/recents";
import type { SavedItemRecord } from "@/lib/saved";
import { getSavedItems, subscribeSavedItems } from "@/lib/saved";
import {
  buildOfflineSavedSearchLinks,
  getOfflineRecentSearchesStorageKey,
  normalizeOfflineFromPath,
  resolveOfflineRouteKind,
  resolveOfflineSectionVisibility,
  type OfflineSavedSearchLink,
} from "@/lib/offline/offline-route";
import type { ViewedItemRecord } from "@/lib/viewed";
import {
  getLastBrowseUrl,
  getViewedItems,
  subscribeLastBrowseUrl,
  subscribeViewedItems,
} from "@/lib/viewed";

type OfflineLocalState = {
  savedItems: SavedItemRecord[];
  viewedItems: ViewedItemRecord[];
  recommendedItems: RecommendedNextItem[];
  savedSearchLinks: OfflineSavedSearchLink[];
};

const EMPTY_LOCAL_STATE: OfflineLocalState = {
  savedItems: [],
  viewedItems: [],
  recommendedItems: [],
  savedSearchLinks: [],
};

function buildOfflineLocalState(input: { marketCountry: string; fromPath: string }): OfflineLocalState {
  const savedItems = getSavedItems({
    marketCountry: input.marketCountry,
    limit: 6,
  });
  const viewedItems = getViewedItems({
    marketCountry: input.marketCountry,
    limit: 6,
  });

  const savedSignals = savedItems.map((item) => ({
    id: item.id,
    kind: item.kind,
    href: item.href,
    marketCountry: item.marketCountry,
    timestamp: item.savedAt,
  }));
  const viewedSignals = viewedItems.map((item) => ({
    id: item.id,
    kind: item.kind,
    href: item.href,
    marketCountry: item.marketCountry,
    timestamp: item.viewedAt,
  }));

  const lastShortletBrowseHref = getLastBrowseUrl({
    kind: "shortlet",
    marketCountry: input.marketCountry,
  });
  const lastPropertyBrowseHref = getLastBrowseUrl({
    kind: "property",
    marketCountry: input.marketCountry,
  });
  const lastSearchHref = getLastSearchHref();

  const routeKind = resolveOfflineRouteKind(input.fromPath);
  const browseHint =
    routeKind === "search"
      ? input.fromPath
      : lastShortletBrowseHref ?? lastPropertyBrowseHref ?? input.fromPath;

  const recommendedItems = buildRecommendedNextItems({
    marketCountry: input.marketCountry,
    savedItems: savedSignals,
    viewedItems: viewedSignals,
    lastBrowseHref: browseHint,
    lastSearchHref,
    limit: 4,
    seedBucket: "offline-shell",
  });

  const savedSearchLinks = buildOfflineSavedSearchLinks({
    fromPath: input.fromPath,
    recentSearchTerms: getRecentSearches(getOfflineRecentSearchesStorageKey(), 4),
    lastSearchHref,
    lastShortletBrowseHref,
    lastPropertyBrowseHref,
    limit: 4,
  });

  return {
    savedItems,
    viewedItems,
    recommendedItems,
    savedSearchLinks,
  };
}

function formatSectionTitle(routeKind: ReturnType<typeof resolveOfflineRouteKind>) {
  if (routeKind === "search") return "Offline search tools";
  if (routeKind === "collections") return "Offline collection access";
  return "Local picks while offline";
}

export function OfflineShell() {
  const { market } = useMarketPreference();
  const searchParams = useSearchParams();
  const fromPath = useMemo(
    () => normalizeOfflineFromPath(searchParams?.get("from")),
    [searchParams]
  );
  const routeKind = useMemo(() => resolveOfflineRouteKind(fromPath), [fromPath]);
  const [localState, setLocalState] = useState<OfflineLocalState>(EMPTY_LOCAL_STATE);

  useEffect(() => {
    const refresh = () =>
      setLocalState(
        buildOfflineLocalState({
          marketCountry: market.country,
          fromPath,
        })
      );

    const frame = window.requestAnimationFrame(refresh);
    const unsubscribeSaved = subscribeSavedItems(refresh);
    const unsubscribeViewed = subscribeViewedItems(refresh);
    const unsubscribeBrowse = subscribeLastBrowseUrl(refresh);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribeSaved();
      unsubscribeViewed();
      unsubscribeBrowse();
      window.removeEventListener("focus", onFocus);
    };
  }, [fromPath, market.country]);

  const visibility = resolveOfflineSectionVisibility({
    routeKind,
    savedCount: localState.savedItems.length,
    viewedCount: localState.viewedItems.length,
    recommendedCount: localState.recommendedItems.length,
    savedSearchCount: localState.savedSearchLinks.length,
  });

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:py-8" data-testid="offline-shell">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Offline</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-slate-600">
          We&apos;ll keep useful local items ready while your connection recovers.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={() => window.location.reload()}
            data-testid="offline-try-again"
          >
            Try again
          </button>
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600" data-testid="offline-route-context">
            From {fromPath}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {formatSectionTitle(routeKind)}
        </p>

        {visibility.showRecommended ? (
          <div className="mt-3 space-y-2" data-testid="offline-recommended-section">
            <h2 className="text-sm font-semibold text-slate-900">Recommended next</h2>
            <div className="space-y-2">
              {localState.recommendedItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-600">{item.reason}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {visibility.showSaved ? (
          <div className="mt-3 space-y-2" data-testid="offline-saved-section">
            <h2 className="text-sm font-semibold text-slate-900">Saved homes</h2>
            <div className="space-y-2">
              {localState.savedItems.map((item) => (
                <Link
                  key={`${item.marketCountry}:${item.id}`}
                  href={item.href}
                  className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-600">{item.subtitle ?? item.tag ?? "Saved listing"}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {visibility.showSavedSearches ? (
          <div className="mt-3 space-y-2" data-testid="offline-saved-searches-section">
            <h2 className="text-sm font-semibold text-slate-900">Saved searches</h2>
            <div className="flex flex-wrap gap-2">
              {localState.savedSearchLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {visibility.showViewed ? (
          <div className="mt-3 space-y-2" data-testid="offline-viewed-section">
            <h2 className="text-sm font-semibold text-slate-900">Recently viewed</h2>
            <div className="space-y-2">
              {localState.viewedItems.map((item) => (
                <Link
                  key={`${item.marketCountry}:${item.kind}:${item.id}`}
                  href={item.href}
                  className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {item.title?.trim() || "Viewed listing"}
                  </p>
                  <p className="text-xs text-slate-600">{item.subtitle ?? item.tag ?? "Open when online"}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {visibility.showCollectionsNote ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600" data-testid="offline-collections-note">
            Collections need a connection to load fresh market picks. Your saved and viewed items remain available.
          </p>
        ) : null}

        {visibility.showEmptyState ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" data-testid="offline-empty-state">
            Save homes to view them offline.
          </p>
        ) : null}
      </section>
    </main>
  );
}
