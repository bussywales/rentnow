import Link from "next/link";
import { cn } from "@/components/ui/cn";

type Props = {
  isAdmin: boolean;
  appVersion: string;
  releaseDate: string;
  releaseNotes: string[];
  className?: string;
};

export function SupportStatusCard({
  isAdmin,
  appVersion,
  releaseDate,
  releaseNotes,
  className,
}: Props) {
  const visibleNotes = releaseNotes.slice(0, 3);

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        className
      )}
      data-testid="support-status-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Platform status</h2>
          <p className="text-sm text-slate-500">
            All systems operational.
          </p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
          Operational
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Recent updates</p>
        <p className="text-xs text-slate-400">
          Version {appVersion} • Released {releaseDate}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-600" data-testid="support-release-notes">
          {visibleNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>

      {isAdmin && (
        <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4" data-testid="support-developer-info">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
            Developer info
          </summary>
          <div className="mt-2 text-sm text-slate-600">
            <p>Full release notes and runtime diagnostics for admins.</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-600">
              {releaseNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <Link href="/api/debug/env" className="mt-3 inline-flex text-sm font-semibold text-sky-700">
              Runtime env check
            </Link>
          </div>
        </details>
      )}
    </div>
  );
}
