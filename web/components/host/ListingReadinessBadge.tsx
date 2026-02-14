import Link from "next/link";
import type { ReadinessResult } from "@/lib/properties/listing-readiness";

type Props = {
  readiness: ReadinessResult;
  improveHref?: string;
};

export function ListingReadinessBadge({ readiness, improveHref }: Props) {
  const topIssue = readiness.issues[0];
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 font-semibold text-slate-900">
          Readiness: {readiness.score} · {readiness.tier}
        </span>
        {improveHref && topIssue && (
          <Link
            href={improveHref}
            className="shrink-0 rounded-full bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-sky-700"
          >
            Improve
          </Link>
        )}
      </div>
      {readiness.issues.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-slate-600">What’s missing?</p>
          <ul className="space-y-1">
            {readiness.issues.map((issue) => (
              <li key={issue.key} className="flex items-start gap-2">
                <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden />
                <span>{issue.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
