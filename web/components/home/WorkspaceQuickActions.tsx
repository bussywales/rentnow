import Link from "next/link";
import { Button } from "@/components/ui/Button";

type WorkspaceHomeRole = "agent" | "landlord";

type WorkspaceTodayHighlight = {
  label: string;
  href?: string;
};

const AGENT_ACTIONS = [
  { href: "/dashboard/properties/new", label: "Add listing" },
  { href: "/host/leads", label: "View leads" },
  { href: "/dashboard/messages", label: "Messages" },
  { href: "/profile/clients", label: "Clients" },
] as const;

const LANDLORD_ACTIONS = [
  { href: "/dashboard/properties/new", label: "Add listing" },
  { href: "/host/bookings", label: "View bookings" },
  { href: "/host/calendar", label: "Calendar" },
  { href: "/host/earnings", label: "Earnings" },
] as const;

export function WorkspaceQuickActions({
  role,
  highlights,
}: {
  role: WorkspaceHomeRole;
  highlights: WorkspaceTodayHighlight[];
}) {
  const actions = role === "agent" ? AGENT_ACTIONS : LANDLORD_ACTIONS;
  const visibleHighlights = highlights.filter((item) => item.label.trim().length > 0);

  return (
    <section
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="home-workspace-quick-actions"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Today</p>
        {visibleHighlights.length ? (
          <div className="flex flex-wrap gap-2" data-testid="home-workspace-today-highlights">
            {visibleHighlights.map((item) =>
              item.href ? (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.label}
                  className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700"
                >
                  {item.label}
                </span>
              )
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-600" data-testid="home-workspace-today-empty">
            No urgent items right now.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2" data-testid="home-workspace-quick-actions-row">
        {actions.map((action) => (
          <Link key={action.href} href={action.href} data-testid={`home-workspace-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <Button variant="secondary">{action.label}</Button>
          </Link>
        ))}
      </div>
    </section>
  );
}
