import Link from "next/link";
import type { FeaturedInventoryItem } from "@/lib/admin/featured-inventory";

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatRank = (value?: number | null) => {
  if (value === null || value === undefined) return "—";
  return String(value);
};

function statusTone(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "live") return "bg-emerald-50 text-emerald-700";
  if (normalized === "pending") return "bg-amber-50 text-amber-700";
  if (normalized.startsWith("paused")) return "bg-slate-100 text-slate-600";
  if (normalized === "expired") return "bg-amber-50 text-amber-700";
  if (normalized === "rejected") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-600";
}

type Props = {
  items: FeaturedInventoryItem[];
  expiringCount: number;
  expiredCount: number;
};

export default function AdminFeaturedInventoryPanel({
  items,
  expiringCount,
  expiredCount,
}: Props) {
  return (
    <section
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
      data-testid="admin-featured-inventory-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Featured inventory</p>
          <h2 className="text-lg font-semibold text-slate-900">Featured right now</h2>
          <p className="text-sm text-slate-600">
            Active featured listings sorted by rank and schedule.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
            Expiring soon: {expiringCount}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
            Expired: {expiredCount}
          </span>
        </div>
      </div>

      {items.length ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
          <div className="grid grid-cols-[2fr_1.3fr_1fr_0.7fr_1fr_auto] gap-2 bg-slate-50 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500">
            <span>Listing</span>
            <span>City</span>
            <span>Status</span>
            <span>Rank</span>
            <span>Until</span>
            <span className="text-right">Action</span>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div
                key={item.id}
                data-testid="admin-featured-row"
                className="grid grid-cols-[2fr_1.3fr_1fr_0.7fr_1fr_auto] items-center gap-2 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{item.title || "Untitled"}</div>
                  <div className="text-[11px] text-slate-500">ID: {item.id}</div>
                </div>
                <div className="truncate text-slate-600">{item.city || "—"}</div>
                <div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusTone(item.status)}`}>
                    {item.status || "unknown"}
                  </span>
                </div>
                <div className="text-slate-700 tabular-nums">{formatRank(item.featured_rank)}</div>
                <div className="text-slate-700 tabular-nums">{formatDate(item.featured_until)}</div>
                <div className="text-right">
                  <Link
                    href={`/admin/listings?property=${encodeURIComponent(item.id)}`}
                    className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                  >
                    Edit featured
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"
          data-testid="admin-featured-empty"
        >
          No active featured listings right now. Use the listing drawer to feature a property.
        </div>
      )}
    </section>
  );
}
