import Link from "next/link";

type TenantHeroProps = {
  name?: string | null;
  savedSearchCount: number;
  primaryCta: { href: string; label: string };
  secondaryCta: { href: string; label: string };
};

function getFirstName(value?: string | null) {
  if (!value) return "there";
  const trimmed = value.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? "there";
}

export function TenantHero({
  name,
  savedSearchCount,
  primaryCta,
  secondaryCta,
}: TenantHeroProps) {
  const firstName = getFirstName(name);
  const searchCopy =
    savedSearchCount > 0
      ? `${savedSearchCount} saved search${savedSearchCount === 1 ? "" : "es"} active`
      : "No saved searches yet";

  return (
    <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-lg">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
        Tenant workspace
      </p>
      <h1 className="mt-2 text-2xl font-semibold">
        Welcome back, {firstName}
      </h1>
      <p className="mt-1 text-sm text-slate-200">
        Track matches, message hosts, and line up viewings from one place.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={primaryCta.href}
          className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
        >
          {primaryCta.label}
        </Link>
        <Link
          href={secondaryCta.href}
          className="inline-flex items-center justify-center rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10"
        >
          {secondaryCta.label}
        </Link>
      </div>
      <p className="mt-4 text-xs uppercase tracking-[0.2em] text-cyan-200">
        {searchCopy}
      </p>
    </section>
  );
}
