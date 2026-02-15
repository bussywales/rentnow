import Link from "next/link";
import type { ChecklistItem } from "@/lib/checklists/role-checklists";
import { buildNextBestActions } from "@/lib/checklists/next-best-actions";

function successHrefByRole(role: "tenant" | "landlord" | "agent" | "admin") {
  return `/help/${role}/success-tips`;
}

export function NextBestActionsPanel({
  role,
  items,
}: {
  role: "tenant" | "landlord" | "agent" | "admin";
  items: ChecklistItem[];
}) {
  const model = buildNextBestActions(items);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="next-best-actions-panel">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Guided help</p>
          <h2 className="text-xl font-semibold text-slate-900">Next best actions</h2>
          <p className="text-sm text-slate-600">
            Progress {model.done}/{model.total} ({model.progressPercent}%)
          </p>
        </div>
        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
          {model.allComplete ? "All core steps complete" : "Recommended next steps"}
        </span>
      </div>

      {model.allComplete ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-semibold">You&apos;re all set.</p>
          <p className="mt-1">
            Keep momentum with advanced playbooks and optimization tips.
          </p>
          <Link
            href={successHrefByRole(role)}
            className="mt-2 inline-flex font-semibold text-emerald-900 underline underline-offset-4"
          >
            Open success tips
          </Link>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {model.actions.map((action) => (
            <div key={action.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <Link href={action.href} className="min-w-0 flex-1 text-sm font-semibold text-slate-900 hover:underline break-words">
                  {action.label}
                </Link>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  To do
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 break-words">{action.why}</p>
              {action.note ? <p className="mt-1 text-xs text-slate-500 break-words">{action.note}</p> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
