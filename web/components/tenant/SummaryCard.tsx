import Link from "next/link";

type SummaryCardProps = {
  title: string;
  value: string;
  description: string;
  helper?: string | null;
  cta?: { href: string; label: string };
};

export function SummaryCard({
  title,
  value,
  description,
  helper,
  cta,
}: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
      {cta && (
        <Link
          href={cta.href}
          className="mt-3 inline-flex text-sm font-semibold text-sky-700"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
