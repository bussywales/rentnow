"use client";

import Link from "next/link";
import { TrustBadges } from "@/components/ui/TrustBadges";
import { getDiscoveryCatalogueItemById, resolveDiscoveryTrustBadges } from "@/lib/discovery";
import type { SavedItemKind, SavedItemRecord } from "@/lib/saved";

type SavedSectionProps = {
  title: string;
  kind: SavedItemKind;
  marketCountry: string;
  items: SavedItemRecord[];
  onRemoveItem: (id: string) => void;
  onClearSection: (kind: SavedItemKind) => void;
};

export function SavedSection({
  title,
  kind,
  marketCountry,
  items,
  onRemoveItem,
  onClearSection,
}: SavedSectionProps) {
  if (!items.length) return null;

  return (
    <section
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
      data-testid={`saved-section-${kind}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-600">{items.length} items</p>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          data-testid={`saved-clear-section-${kind}`}
          onClick={() => onClearSection(kind)}
        >
          Clear section
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const catalogueItem = getDiscoveryCatalogueItemById(item.id);
          const badges = catalogueItem
            ? resolveDiscoveryTrustBadges({
                item: catalogueItem,
              })
            : [];
          return (
            <article
              key={`${item.marketCountry}:${item.id}`}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
              data-testid="saved-item-row"
            >
              <Link href={item.href} className="min-w-0 flex-1 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {item.tag ?? (item.kind === "shortlet" ? "Shortlets" : "Properties")}
                </p>
                <TrustBadges badges={badges} marketCountry={marketCountry} />
                <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.title}</p>
                {item.subtitle ? <p className="line-clamp-2 text-xs text-slate-600">{item.subtitle}</p> : null}
              </Link>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                data-testid="saved-remove-item"
                onClick={() => onRemoveItem(item.id)}
              >
                Remove
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
