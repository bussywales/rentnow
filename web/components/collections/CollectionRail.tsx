import Link from "next/link";
import type { CollectionCard } from "@/lib/collections/collections-select";

type CollectionRailProps = {
  cards: CollectionCard[];
};

export function CollectionRail({ cards }: CollectionRailProps) {
  if (!cards.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Featured in this collection</h2>
      <div
        className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
        data-testid="collections-rail"
      >
        {cards.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            data-testid="collections-card"
            className="inline-flex w-[250px] shrink-0 snap-start flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {card.tag}
            </span>
            <p className="text-base font-semibold text-slate-900">{card.title}</p>
            <p className="text-sm text-slate-600">{card.subtitle}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

