import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { loadAdminSubscriptionPriceMatrix, parseAdminSubscriptionPriceMatrixFilters } from "@/lib/billing/subscription-price-book.server";
import { SUBSCRIPTION_PRICE_BOOK_FILTER_OPTIONS } from "@/lib/billing/subscription-price-book";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatProviderMode(mode: string) {
  return mode === "live" ? "Live" : "Test";
}

function activeLabel(active: boolean) {
  return active ? "Active" : "Inactive";
}

function fallbackLabel(enabled: boolean) {
  return enabled ? "Yes" : "No";
}

export default async function AdminBillingPricesPage({ searchParams }: Props) {
  if (!hasServerSupabaseEnv()) {
    return <div className="p-6 text-sm text-slate-600">Supabase is not configured.</div>;
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/required?redirect=/admin/settings/billing/prices&reason=auth");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const filters = parseAdminSubscriptionPriceMatrixFilters(resolvedParams);
  const { entries, summary, providerModes } = await loadAdminSubscriptionPriceMatrix(filters);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8" data-testid="admin-billing-prices-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
          <h1 className="text-3xl font-semibold text-slate-900">Subscription price matrix</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Canonical subscription pricing truth from <code>subscription_price_book</code>, compared against the current runtime checkout resolver.
            This is read-only groundwork for admin-owned pricing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/settings/billing"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-300"
          >
            Billing settings
          </Link>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Canonical rows</p><p className="mt-2 text-2xl font-semibold text-slate-900">{summary.canonicalRows}</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-amber-700">Market gaps</p><p className="mt-2 text-2xl font-semibold text-amber-900">{summary.marketGaps}</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-amber-700">Runtime fallbacks</p><p className="mt-2 text-2xl font-semibold text-amber-900">{summary.runtimeFallbacks}</p></div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-rose-700">Missing provider refs</p><p className="mt-2 text-2xl font-semibold text-rose-900">{summary.missingProviderRefs}</p></div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-rose-700">Checkout mismatches</p><p className="mt-2 text-2xl font-semibold text-rose-900">{summary.checkoutMismatches}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">Superseded rows</p><p className="mt-2 text-2xl font-semibold text-slate-900">{summary.supersededRows}</p></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">Stripe {formatProviderMode(providerModes.stripeMode)}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">Paystack {formatProviderMode(providerModes.paystackMode)}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">Flutterwave {formatProviderMode(providerModes.flutterwaveMode)}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form method="get" action="/admin/settings/billing/prices" className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
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
                <option key={role} value={role}>{role}</option>
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
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Provider</span>
            <select name="provider" defaultValue={filters.provider} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="all">All providers</option>
              {SUBSCRIPTION_PRICE_BOOK_FILTER_OPTIONS.providers.map((provider) => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Active</span>
            <select name="active" defaultValue={filters.active} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Fallback eligible</span>
            <select name="fallbackEligible" defaultValue={filters.fallbackEligible} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="all">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <div className="md:col-span-3 xl:col-span-6 flex flex-wrap gap-2">
            <button type="submit" className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700">Apply filters</button>
            <Link href="/admin/settings/billing/prices" className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-300">Reset</Link>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Cadence</th>
                <th className="px-4 py-3">Canonical</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Provider ref</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">Fallback eligible</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Runtime checkout</th>
                <th className="px-4 py-3">Diagnostics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-sm text-slate-500">No rows match the current filter set.</td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.key}>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <div className="font-semibold text-slate-900">{entry.marketCountry}</div>
                      <div className="text-xs text-slate-500">{entry.marketLabel}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <div className="font-semibold text-slate-900">{entry.roleLabel}</div>
                      <div className="text-xs text-slate-500">{entry.tierLabel}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">{entry.cadence}</td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      {entry.canonicalRow ? (
                        <>
                          <div className="font-semibold text-slate-900">{entry.canonicalDisplayPrice}</div>
                          <div className="text-xs text-slate-500">{entry.canonicalRow.currency}</div>
                          {entry.canonicalRow.operator_notes ? (
                            <div className="mt-1 text-[11px] text-slate-500">{entry.canonicalRow.operator_notes}</div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-amber-700">Missing canonical row</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">{entry.canonicalProvider || "—"}</td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      {entry.canonicalProviderRef ? (
                        <code className="text-xs text-slate-700">{entry.canonicalProviderRef}</code>
                      ) : (
                        <span className="text-rose-700">Missing ref</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">{activeLabel(entry.canonicalActive)}</td>
                    <td className="px-4 py-3 align-top text-slate-700">{fallbackLabel(entry.canonicalFallbackEligible)}</td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <div>{formatDate(entry.canonicalUpdatedAt)}</div>
                      <div className="text-xs text-slate-500">{entry.canonicalUpdatedBy || "—"}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <div className="font-semibold text-slate-900">{entry.runtimeQuote.displayPrice}</div>
                      <div className="text-xs text-slate-500">{entry.runtimeQuote.provider || "Unavailable"}</div>
                      {entry.runtimeQuote.resolutionKey ? <div className="mt-1 text-[11px] text-slate-500">{entry.runtimeQuote.resolutionKey}</div> : null}
                      {entry.runtimeQuote.priceId ? <div className="mt-1 text-[11px] text-slate-500">{entry.runtimeQuote.priceId}</div> : null}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <div className="flex flex-wrap gap-2">
                        {entry.checkoutMatchesCanonical ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Aligned</span>
                        ) : null}
                        {entry.diagnostics.length ? entry.diagnostics.map((diagnostic) => (
                          <span key={diagnostic} className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">{diagnostic}</span>
                        )) : <span className="text-xs text-slate-500">—</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
