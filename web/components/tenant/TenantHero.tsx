import Link from "next/link";

type TenantHeroProps = {
  name?: string | null;
  savedSearchCount: number;
  primaryCta: { href: string; label: string };
  secondaryCta: { href: string; label: string };
};

function getFirstName(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0] ?? null;
}

export function TenantHero({
  name,
  savedSearchCount,
  primaryCta,
  secondaryCta,
}: TenantHeroProps) {
  const firstName = getFirstName(name);
  const headline = firstName ? `Welcome back, ${firstName}` : "Welcome back";
  const searchCopy =
    savedSearchCount > 0
      ? `${savedSearchCount} saved search${savedSearchCount === 1 ? "" : "es"} active`
      : "Save a search for new match alerts";

  return (
    <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-lg ring-1 ring-white/10">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/90">
        Tenant workspace
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{headline}</h1>
      <p className="mt-2 text-sm text-slate-200">
        Track matches, message hosts, and line up viewings from one calm hub.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={primaryCta.href}
          className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          {primaryCta.label}
        </Link>
        <Link
          href={secondaryCta.href}
          className="inline-flex items-center justify-center rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          {secondaryCta.label}
        </Link>
      </div>
      <p className="mt-5 text-xs uppercase tracking-[0.2em] text-cyan-200/80">
        {searchCopy}
      </p>
    </section>
  );
}
