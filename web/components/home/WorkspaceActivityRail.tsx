import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type {
  WorkspaceActivityItem,
  WorkspaceActivityType,
} from "@/lib/activity/workspace-activity.server";

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

const typeBadgeStyles: Record<
  WorkspaceActivityType,
  {
    icon: string;
    className: string;
  }
> = {
  lead_received: {
    icon: "LD",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  booking_request: {
    icon: "BK",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  listing_approved: {
    icon: "LS",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  payout_requested: {
    icon: "PO",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  payout_paid: {
    icon: "PD",
    className: "border-teal-200 bg-teal-50 text-teal-700",
  },
  support_escalated: {
    icon: "SP",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  message_received: {
    icon: "MS",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
};

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
    <section
      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-label="Activity"
      data-testid="workspace-activity-rail"
    >
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
            <li key={item.id} data-testid="workspace-activity-item">
              <div className="rounded-2xl border border-slate-200 px-3 py-2 transition-colors hover:border-sky-200 hover:bg-sky-50 md:px-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        data-testid={`workspace-activity-badge-${item.type}`}
                        className={[
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                          typeBadgeStyles[item.type].className,
                        ].join(" ")}
                      >
                        <span aria-hidden className="font-bold">
                          {typeBadgeStyles[item.type].icon}
                        </span>
                        <span>{item.label}</span>
                      </span>
                      {item.badge ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                    <Link href={item.href} className="block truncate text-sm font-semibold text-slate-900 hover:text-sky-700">
                      {item.title}
                    </Link>
                    {item.subtitle ? <p className="truncate text-xs text-slate-600">{item.subtitle}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <span className="text-xs text-slate-500">{formatActivityAgeLabel(item.createdAt)}</span>
                    <Link
                      href={item.href}
                      data-testid="workspace-activity-cta"
                      className="text-xs font-semibold text-sky-700 hover:text-sky-800"
                    >
                      {item.ctaLabel}
                    </Link>
                  </div>
                </div>
              </div>
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
