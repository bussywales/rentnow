import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { WorkspaceActivityItem } from "@/lib/activity/workspace-activity.server";

type WorkspaceActivityRole = "agent" | "landlord" | "tenant";

function formatActivityAgeLabel(createdAtIso: string, nowMs = Date.now()) {
  const createdAtMs = Date.parse(createdAtIso);
  if (!Number.isFinite(createdAtMs)) return "Recently";

  const deltaSeconds = Math.max(0, Math.floor((nowMs - createdAtMs) / 1000));
  if (deltaSeconds < 60) return "Just now";
  if (deltaSeconds < 60 * 60) return `${Math.floor(deltaSeconds / 60)}m ago`;
  if (deltaSeconds < 24 * 60 * 60) return `${Math.floor(deltaSeconds / 3600)}h ago`;
  if (deltaSeconds < 48 * 60 * 60) return "Yesterday";
  return `${Math.floor(deltaSeconds / (24 * 3600))}d ago`;
}

export function WorkspaceActivityRail({
  role,
  items,
}: {
  role: WorkspaceActivityRole;
  items: WorkspaceActivityItem[];
}) {
  if (role === "tenant") return null;

  const visibleItems = items.slice(0, 6);
  const viewAllHref = role === "agent" ? "/host/leads" : "/host/bookings?view=awaiting_approval";
  const emptyHref = role === "agent" ? "/host/leads" : "/host/bookings";
  const emptyCtaLabel = role === "agent" ? "Open leads" : "Open bookings";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Activity">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Activity</p>
          <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
        </div>
        <Link href={viewAllHref} className="text-xs font-semibold text-sky-700 hover:text-sky-800">
          View all
        </Link>
      </div>

      {visibleItems.length > 0 ? (
        <ul className="space-y-2">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 px-3 py-2 transition-colors hover:border-sky-200 hover:bg-sky-50"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
                    <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                    {item.badge ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                        {item.badge}
                      </span>
                    ) : null}
                  </div>
                  {item.subtitle ? <p className="truncate text-xs text-slate-600">{item.subtitle}</p> : null}
                </div>
                <span className="shrink-0 text-xs text-slate-500">{formatActivityAgeLabel(item.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
          <p className="text-sm font-medium text-slate-700">No new activity yet</p>
          <p className="mt-1 text-xs text-slate-600">Recent activity from leads, bookings, approvals, and payouts will appear here.</p>
          <div className="mt-3">
            <Link href={emptyHref}>
              <Button size="sm" variant="secondary">
                {emptyCtaLabel}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
