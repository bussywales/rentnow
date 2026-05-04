import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { loadAdminMarketPricingControlPlane } from "@/lib/billing/market-pricing-control-plane.server";
import {
  formatMarketPricingPolicyStateLabel,
  formatMarketPricingProductLabel,
  formatMarketPricingRoleLabel,
  formatMarketPricingTierLabel,
} from "@/lib/billing/market-pricing";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null) {
  if (!value) return "—";
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

function formatAmount(currency: string, amountMinor: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default async function AdminMarketPricingPage() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/required?redirect=/admin/settings/billing/market-pricing&reason=auth");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  const state = await loadAdminMarketPricingControlPlane(supabase);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8" data-testid="admin-market-pricing-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
          <h1 className="text-3xl font-semibold text-slate-900">Market pricing control plane</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Read-only market pricing and entitlement foundation for future market-managed billing. This page does not
            switch runtime billing or listing enforcement yet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/settings/billing"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-300"
          >
            Billing settings
          </Link>
          <Link
            href="/admin/settings/billing/prices"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-300"
          >
            Subscription pricing control plane
          </Link>
          <Link
            href="/admin/delivery-monitor"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-300"
          >
            Delivery monitor
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900" data-testid="market-pricing-legacy-warning">
        This page is currently a control-plane foundation. Runtime billing still uses legacy settings until integration is explicitly shipped.
      </div>

      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900" data-testid="market-pricing-canada-guardrail-warning">
        Canada PAYG is not live. Draft rows do not enable checkout.
      </div>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="market-pricing-summary-grid">
        <SummaryCard label="Policy rows" value={state.summary.policyRows} />
        <SummaryCard label="Live policies" value={state.summary.livePolicies} />
        <SummaryCard label="Draft policies" value={state.summary.draftPolicies} />
        <SummaryCard label="Entitlement rows" value={state.summary.activeEntitlementRows} />
        <SummaryCard label="One-off price rows" value={state.summary.activeOneOffPriceRows} />
        <SummaryCard label="Audit rows" value={state.summary.auditRows} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="market-pricing-runtime-diagnostics">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Runtime source diagnostics</p>
            <p className="mt-1 text-sm text-slate-600">
              Repo truth today: recurring subscription pricing is canonical, but PAYG and listing-cap enforcement still resolve from legacy settings and code constants.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {state.diagnostics.map((diagnostic) => (
            <div key={diagnostic.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{diagnostic.label}</p>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {diagnostic.status}
                </span>
              </div>
              <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">{diagnostic.runtimeSource}</p>
              <p className="mt-2 text-sm text-slate-700">{diagnostic.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="market-pricing-policies-section">
        <div>
          <p className="text-sm font-semibold text-slate-900">Market policy rows</p>
          <p className="mt-1 text-sm text-slate-600">Per-market commercial gating and provider envelope. These rows are seeded for visibility and audit only in this batch.</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">State</th>
                <th className="px-3 py-2">Currency</th>
                <th className="px-3 py-2">Providers</th>
                <th className="px-3 py-2">Enabled lanes</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.policies.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 font-medium text-slate-900">{row.market_country}</td>
                  <td className="px-3 py-3 text-slate-700">{formatMarketPricingPolicyStateLabel(row.policy_state)}</td>
                  <td className="px-3 py-3 text-slate-700">{row.currency}</td>
                  <td className="px-3 py-3 text-slate-700">
                    Listing: {row.listing_payg_provider ?? "—"}
                    <br />
                    Featured: {row.featured_listing_provider ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    Rental {row.rental_enabled ? "Yes" : "No"} · Sale {row.sale_enabled ? "Yes" : "No"} · Shortlet {row.shortlet_enabled ? "Yes" : "No"}
                    <br />
                    PAYG {row.payg_listing_enabled ? "Yes" : "No"} · Featured {row.featured_listing_enabled ? "Yes" : "No"} · Subs {row.subscription_checkout_enabled ? "Yes" : "No"}
                  </td>
                  <td className="px-3 py-3 text-slate-700">{row.operator_notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="market-pricing-one-off-section">
        <div>
          <p className="text-sm font-semibold text-slate-900">One-off price rows</p>
          <p className="mt-1 text-sm text-slate-600">Future market-aware PAYG and featured pricing rows. Runtime checkout still uses legacy settings in this batch.</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.oneOffPrices.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 font-medium text-slate-900">{row.market_country}</td>
                  <td className="px-3 py-3 text-slate-700">{formatMarketPricingProductLabel(row.product_code)}</td>
                  <td className="px-3 py-3 text-slate-700">{row.provider}</td>
                  <td className="px-3 py-3 text-slate-700">{formatAmount(row.currency, row.amount_minor)}</td>
                  <td className="px-3 py-3 text-slate-700">{row.enabled ? "Yes" : "No"}</td>
                  <td className="px-3 py-3 text-slate-700">{row.operator_notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="market-pricing-entitlements-section">
        <div>
          <p className="text-sm font-semibold text-slate-900">Listing entitlement rows</p>
          <p className="mt-1 text-sm text-slate-600">Market x role x tier matrix for future listing-cap and credit control. Current runtime still reads plans.ts and profile overrides.</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">Active listing limit</th>
                <th className="px-3 py-2">Credits</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.entitlements.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 font-medium text-slate-900">{row.market_country}</td>
                  <td className="px-3 py-3 text-slate-700">{formatMarketPricingRoleLabel(row.role)}</td>
                  <td className="px-3 py-3 text-slate-700">{formatMarketPricingTierLabel(row.tier)}</td>
                  <td className="px-3 py-3 text-slate-700">{row.active_listing_limit}</td>
                  <td className="px-3 py-3 text-slate-700">
                    Listing {row.listing_credits} · Featured {row.featured_credits}
                    <br />
                    Client pages {row.client_page_limit ?? "—"} · Beyond cap {row.payg_beyond_cap_enabled ? "Yes" : "No"}
                  </td>
                  <td className="px-3 py-3 text-slate-700">{row.operator_notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="market-pricing-audit-section">
        <div>
          <p className="text-sm font-semibold text-slate-900">Recent audit entries</p>
          <p className="mt-1 text-sm text-slate-600">Compact history so operators can see seeded foundation activity without implying runtime integration.</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">Event</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.auditRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 text-slate-700">{formatDateTime(row.created_at)}</td>
                  <td className="px-3 py-3 text-slate-700">{row.entity_type}</td>
                  <td className="px-3 py-3 text-slate-700">{row.market_country ?? "—"}</td>
                  <td className="px-3 py-3 text-slate-700">{row.event_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
