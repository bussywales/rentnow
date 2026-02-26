"use client";

import { useEffect, useMemo, useState } from "react";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { SavedBulkActions } from "@/components/saved/SavedBulkActions";
import { SavedEmptyState } from "@/components/saved/SavedEmptyState";
import { SavedSection } from "@/components/saved/SavedSection";
import {
  buildSavedSuggestions,
  clearSavedItems,
  clearSavedSection,
  getSavedItems,
  groupSavedItemsByKind,
  removeSavedItem,
  subscribeSavedItems,
  type SavedItemKind,
  type SavedItemRecord,
} from "@/lib/saved";

export function SavedPageClient() {
  const { market } = useMarketPreference();
  const [items, setItems] = useState<SavedItemRecord[]>([]);

  useEffect(() => {
    const refresh = () =>
      setItems(
        getSavedItems({
          marketCountry: market.country,
        })
      );

    const frame = window.requestAnimationFrame(refresh);
    const unsubscribe = subscribeSavedItems(refresh);
    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [market.country]);

  const grouped = useMemo(() => groupSavedItemsByKind(items), [items]);
  const suggestions = useMemo(
    () =>
      buildSavedSuggestions({
        marketCountry: market.country,
        limitPerSection: 4,
      }),
    [market.country]
  );

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 md:py-8" data-testid="saved-page">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Saved</p>
        <h1 className="text-2xl font-semibold text-slate-900">Your favourites</h1>
        <p className="text-sm text-slate-600">Saved homes for market {market.country}.</p>
      </header>

      {items.length ? (
        <>
          <SavedBulkActions
            totalCount={items.length}
            onClearAll={() => {
              clearSavedItems({ marketCountry: market.country });
            }}
          />
          <SavedSection
            title="Saved Shortlets"
            kind="shortlet"
            marketCountry={market.country}
            items={grouped.shortlets}
            onRemoveItem={(id) => {
              removeSavedItem({ id, marketCountry: market.country });
            }}
            onClearSection={(kind: SavedItemKind) => {
              clearSavedSection({ kind, marketCountry: market.country });
            }}
          />
          <SavedSection
            title="Saved Properties"
            kind="property"
            marketCountry={market.country}
            items={grouped.properties}
            onRemoveItem={(id) => {
              removeSavedItem({ id, marketCountry: market.country });
            }}
            onClearSection={(kind: SavedItemKind) => {
              clearSavedSection({ kind, marketCountry: market.country });
            }}
          />
        </>
      ) : (
        <SavedEmptyState
          marketCountry={market.country}
          shortletSuggestions={suggestions.shortlets}
          propertySuggestions={suggestions.properties}
        />
      )}
    </main>
  );
}
