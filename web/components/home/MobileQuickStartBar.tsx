import Link from "next/link";

const QUICK_START_LINKS = [
  { key: "shortlets", href: "/shortlets", label: "Shortlets" },
  { key: "rent", href: "/properties?intent=rent", label: "To rent" },
  { key: "sale", href: "/properties?intent=sale", label: "For sale" },
  { key: "all", href: "/properties", label: "All homes" },
] as const;

export function MobileQuickStartBar() {
  return (
    <section
      className="md:hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
      data-testid="mobile-quickstart"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Quick start</p>
      <Link
        href="/properties?focus=search"
        className="mt-2 block rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700"
      >
        Search for homes or stays
      </Link>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {QUICK_START_LINKS.map((entry) => (
          <Link
            key={entry.key}
            href={entry.href}
            className="rounded-full border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-700"
          >
            {entry.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
