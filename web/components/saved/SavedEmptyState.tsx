"use client";

import Link from "next/link";
import { SaveToggle } from "@/components/saved/SaveToggle";
import { TrustBadges } from "@/components/ui/TrustBadges";
import type { SavedSuggestionItem } from "@/lib/saved";

type SavedEmptyStateProps = {
  marketCountry: string;
  shortletSuggestions: SavedSuggestionItem[];
  propertySuggestions: SavedSuggestionItem[];
};

function SuggestionStrip({
  items,
  marketCountry,
  kind,
  title,
}: {
  items: SavedSuggestionItem[];
  marketCountry: string;
  kind: "shortlet" | "property";
  title: string;
}) {
  if (!items.length) return null;

  return (
    <div className="space-y-2" data-testid={`saved-empty-suggestions-${kind}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <div className="scrollbar-none flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1">
        {items.map((item) => (
          <div
            key={`${item.kind}:${item.id}`}
            className="relative w-[240px] shrink-0 snap-start rounded-xl border border-slate-200 bg-white p-3"
            data-testid="saved-suggestion-item"
          >
            <SaveToggle
              itemId={item.id}
              kind={item.kind}
              href={item.href}
              title={item.title}
              subtitle={item.subtitle}
              tag={item.tag}
              marketCountry={marketCountry}
              className="absolute right-2.5 top-2.5 z-[2] h-8 w-8"
              testId={`save-toggle-${item.id}`}
            />
            <Link href={item.href} className="block space-y-1 pr-9">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {item.tag}
              </span>
              <TrustBadges badges={item.badges} marketCountry={marketCountry} />
              <p className="line-clamp-2 text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="line-clamp-2 text-xs text-slate-600">{item.subtitle}</p>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SavedEmptyState({
  marketCountry,
  shortletSuggestions,
  propertySuggestions,
}: SavedEmptyStateProps) {
  return (
    <section
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4"
      data-testid="saved-empty-state"
    >
      <div className="space-y-1">
        <p className="text-base font-semibold text-slate-900">No saved homes yet</p>
        <p className="text-sm text-slate-600">
          Start saving listings in this market and they will appear here instantly.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to home
        </Link>
        <Link
          href="/shortlets"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Browse shortlets
        </Link>
        <Link
          href="/properties"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Browse properties
        </Link>
      </div>
      <div className="space-y-3" data-testid="saved-empty-suggestions">
        <SuggestionStrip
          items={shortletSuggestions}
          marketCountry={marketCountry}
          kind="shortlet"
          title="Suggested shortlets"
        />
        <SuggestionStrip
          items={propertySuggestions}
          marketCountry={marketCountry}
          kind="property"
          title="Suggested properties"
        />
      </div>
    </section>
  );
}
