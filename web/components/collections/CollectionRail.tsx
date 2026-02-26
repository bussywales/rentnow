import Link from "next/link";
import { SaveToggle } from "@/components/saved/SaveToggle";
import { TrustBadges } from "@/components/ui/TrustBadges";
import type { CollectionCard } from "@/lib/collections/collections-select";

type CollectionRailProps = {
  cards: CollectionCard[];
  marketCountry: string;
};

export function CollectionRail({ cards, marketCountry }: CollectionRailProps) {
  if (!cards.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Featured in this collection</h2>
      <div
        className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
        data-testid="collections-rail"
      >
        {cards.map((card) => (
          <div key={card.id} className="relative w-[250px] shrink-0 snap-start">
            <SaveToggle
              itemId={card.id}
              kind={card.kind}
              href={card.href}
              title={card.title}
              subtitle={card.subtitle}
              tag={card.tag}
              marketCountry={marketCountry}
              className="absolute right-3 top-3 z-[2]"
              testId={`save-toggle-${card.id}`}
            />
            <Link
              href={card.href}
              data-testid="collections-card"
              className="inline-flex w-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {card.tag}
              </span>
              <TrustBadges badges={card.badges} marketCountry={marketCountry} />
              <p className="pr-10 text-base font-semibold text-slate-900">{card.title}</p>
              <p className="text-sm text-slate-600">{card.subtitle}</p>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
