import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import {
  SUBSCRIPTION_PRICE_BOOK_FILTER_OPTIONS,
  getSubscriptionRoleLabel,
} from "@/lib/billing/subscription-price-book";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  buildSubscriptionPriceHistoryHref,
  formatSubscriptionPriceAuditEventLabel,
  parseAdminSubscriptionPriceAuditFilters,
  SUBSCRIPTION_PRICE_AUDIT_EVENT_OPTIONS,
} from "@/lib/billing/subscription-price-history";
import { loadAdminSubscriptionPriceAuditLogView } from "@/lib/billing/subscription-price-control-plane.server";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildPageHref(
  filters: ReturnType<typeof parseAdminSubscriptionPriceAuditFilters>,
  page: number
) {
  return buildSubscriptionPriceHistoryHref({
    marketCountry: filters.market !== "ALL" ? filters.market : undefined,
    role: filters.role !== "all" ? (filters.role as "tenant" | "landlord" | "agent") : undefined,
    cadence: filters.cadence !== "all" ? (filters.cadence as "monthly" | "yearly") : undefined,
    eventType:
      filters.eventType !== "all"
        ? (filters.eventType as
            | "draft_created"
            | "draft_updated"
            | "stripe_price_created"
            | "stripe_price_invalidated"
            | "published")
        : undefined,
    actorId: filters.actorId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    page,
  });
}

export default async function AdminBillingPriceHistoryPage({ searchParams }: Props) {
  if (!hasServerSupabaseEnv()) {
    return <div className="p-6 text-sm text-slate-600">Supabase is not configured.</div>;
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/required?redirect=/admin/settings/billing/prices/history&reason=auth");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const filters = parseAdminSubscriptionPriceAuditFilters(resolvedParams);
  const audit = await loadAdminSubscriptionPriceAuditLogView(filters);

  const isRowScoped =
    filters.market !== "ALL" && filters.role !== "all" && filters.cadence !== "all";

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8" data-testid="admin-billing-prices-history-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
          <h1 className="text-3xl font-semibold text-slate-900">
            {isRowScoped ? "Subscription pricing row history" : "Subscription pricing audit log"}
          </h1>
          <p className="max-w-3xl text-sm text-slate-600">
            {isRowScoped
              ? `Showing pricing lineage for ${filters.market} · ${getSubscriptionRoleLabel(filters.role as "tenant" | "landlord" | "agent")} · ${filters.cadence}. Use this view to inspect draft updates, Stripe ref events, and publish history for one pricing lane.`
              : "Full bounded audit log for canonical subscription pricing activity. Use this page for the complete ledger; the main control plane only shows a recent summary."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/settings/billing/prices"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-300"
          >
            Back to control plane
          </Link>
          <Link
            href="/help/admin/support-playbooks/subscription-pricing"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-300"
          >
            Pricing SOP
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form method="get" action="/admin/settings/billing/prices/history" className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Market</span>
            <select name="market" defaultValue={filters.market} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="ALL">All markets</option>
              {SUBSCRIPTION_PRICE_BOOK_FILTER_OPTIONS.markets.map((market) => (
                <option key={market.country} value={market.country}>{market.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Role</span>
            <select name="role" defaultValue={filters.role} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="all">All roles</option>
              {SUBSCRIPTION_PRICE_BOOK_FILTER_OPTIONS.roles.map((role) => (
                <option key={role} value={role}>{getSubscriptionRoleLabel(role)}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Cadence</span>
            <select name="cadence" defaultValue={filters.cadence} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="all">All cadences</option>
              {SUBSCRIPTION_PRICE_BOOK_FILTER_OPTIONS.cadences.map((cadence) => (
                <option key={cadence} value={cadence}>{cadence}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Event type</span>
            <select name="eventType" defaultValue={filters.eventType} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="all">All events</option>
              {SUBSCRIPTION_PRICE_AUDIT_EVENT_OPTIONS.map((event) => (
                <option key={event.value} value={event.value}>{event.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Actor</span>
            <select name="actorId" defaultValue={filters.actorId} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">All actors</option>
              {audit.actorOptions.map((actor) => (
                <option key={actor.id} value={actor.id}>{actor.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Date from</span>
            <input type="date" name="dateFrom" defaultValue={filters.dateFrom} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Date to</span>
            <input type="date" name="dateTo" defaultValue={filters.dateTo} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </label>
          <div className="flex flex-wrap gap-2 md:col-span-3 xl:col-span-7">
            <button type="submit" className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700">
              Apply filters
            </button>
            <Link
              href="/admin/settings/billing/prices/history"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-300"
            >
              Reset
            </Link>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Audit entries</p>
            <p className="mt-1 text-xs text-slate-500">
              Page {audit.page} of {audit.totalPages} · {audit.total} total events
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Row</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Before</th>
                <th className="px-4 py-3">After</th>
                <th className="px-4 py-3">Stripe ref</th>
                <th className="px-4 py-3">Row history</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {audit.entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                    No pricing history matches the current filters.
                  </td>
                </tr>
              ) : (
                audit.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 align-top text-slate-700">{formatDateTime(entry.createdAt)}</td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <div className="font-semibold text-slate-900">
                        {entry.marketCountry} · {entry.roleLabel} · {entry.cadence}
                      </div>
                      <div className="text-xs text-slate-500">{entry.provider}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {formatSubscriptionPriceAuditEventLabel(entry.eventType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">{entry.actorLabel || "Unknown admin"}</td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <div>{entry.previousDisplayPrice || "—"}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <div>{entry.nextDisplayPrice || "—"}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <div className="text-xs text-slate-700">{entry.previousProviderPriceRef || "—"}</div>
                      <div className="mt-1 text-xs text-slate-500">{entry.nextProviderPriceRef || "—"}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={buildSubscriptionPriceHistoryHref({
                          marketCountry: entry.marketCountry,
                          role: entry.role,
                          cadence: entry.cadence,
                        })}
                        className="text-sm font-medium text-sky-700 hover:text-sky-800"
                      >
                        View row history
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-600">
          <p>Use row history to stay inside one pricing lane. Use the full audit view for cross-market or cross-role audits.</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildPageHref(filters, Math.max(1, audit.page - 1))}
              className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 font-medium ${
                audit.page <= 1
                  ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                  : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
              }`}
            >
              Previous
            </Link>
            <Link
              href={buildPageHref(filters, Math.min(audit.totalPages, audit.page + 1))}
              className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 font-medium ${
                audit.page >= audit.totalPages
                  ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400"
                  : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
