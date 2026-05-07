import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { AdminMarketPricingControlPlaneEditor } from "@/components/admin/AdminMarketPricingControlPlaneEditor";
import { loadAdminMarketPricingControlPlane } from "@/lib/billing/market-pricing-control-plane.server";
import { getCanadaRentalPaygRuntimeDiagnostics } from "@/lib/billing/canada-payg-runtime.server";

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
  const canadaRuntimeDiagnostics = await getCanadaRentalPaygRuntimeDiagnostics(supabase);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8" data-testid="admin-market-pricing-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
          <h1 className="text-3xl font-semibold text-slate-900">Market pricing control plane</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Market pricing and entitlement foundation for future market-managed billing. Admin edits on this page write
            control-plane rows and audit history only; runtime billing and listing enforcement stay unchanged.
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

      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-900" data-testid="market-pricing-enterprise-planning-warning">
        Role/tier price rows are still control-plane only. Enterprise pricing rows remain planning-only until Enterprise runtime tier support is explicitly implemented.
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm text-indigo-900" data-testid="market-pricing-canada-readiness-warning">
        Canada PAYG readiness resolver is available for validation only. Checkout remains disabled and production runtime still uses legacy PAYG and listing-cap enforcement.
      </div>

      <section
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        data-testid="market-pricing-canada-runtime-diagnostics"
      >
        <div>
          <p className="text-sm font-semibold text-slate-900">Canada runtime diagnostics</p>
          <p className="mt-1 text-sm text-slate-600">
            Guarded runtime wiring exists for validation, but Canada checkout is still intentionally disabled.
          </p>
        </div>
        <dl className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Runtime gate</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.gateEnabled ? "ON" : "OFF"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Resolver available</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.resolverAvailable ? "YES" : "NO"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Checkout enabled</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.checkoutEnabled ? "YES" : "NO"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Stripe prep layer</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.stripePrepLayerAvailable ? "AVAILABLE" : "UNAVAILABLE"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Checkout creation</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.checkoutCreationEnabled ? "ENABLED" : "DISABLED"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Stripe session request</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.stripeSessionRequestDefined ? "DEFINED" : "UNDEFINED"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Canada payment recovery</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.paymentRecoveryScaffolded ? "SCAFFOLDED / NOT LIVE" : "UNAVAILABLE"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Canada webhook contract</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.webhookContractDefined ? "DEFINED" : "UNDEFINED"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Payment persistence contract</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.paymentPersistenceContractDefined ? "DEFINED" : "UNDEFINED"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Entitlement grant contract</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.entitlementGrantContractDefined ? "DEFINED" : "UNDEFINED"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Payment persistence payload</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.paymentPersistencePayloadDefined ? "DEFINED" : "UNDEFINED"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Entitlement grant payload</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.entitlementGrantPayloadDefined ? "DEFINED" : "UNDEFINED"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Entitlement read integration</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.entitlementReadIntegrationAvailable ? "AVAILABLE" : "UNAVAILABLE"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Live webhook fulfilment</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.liveWebhookFulfilmentEnabled ? "ENABLED" : "DISABLED"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Canada fulfilment plan</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.fulfilmentPlanDefined ? "DEFINED" : "UNDEFINED"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Fulfilment execution</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.fulfilmentExecutionEnabled ? "ENABLED" : "DISABLED"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Fulfilment mutation</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.fulfilmentMutationEnabled ? "ENABLED" : "DISABLED"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Listing unlock execution</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.listingUnlockEnabled ? "ENABLED" : "DISABLED"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Entitlement consume mutation</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.entitlementConsumeMutationEnabled ? "ENABLED" : "DISABLED"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Payment record write</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.paymentRecordWriteEnabled ? "ENABLED" : "DISABLED"}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Canada session creation</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">BLOCKED BY DESIGN</dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Runtime source</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">
              {canadaRuntimeDiagnostics.runtimeSource}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Next activation prerequisites</dt>
            <dd className="mt-2 text-sm text-slate-700">
              {canadaRuntimeDiagnostics.nextActivationPrerequisites.length}
            </dd>
          </div>
        </dl>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {canadaRuntimeDiagnostics.nextActivationPrerequisites.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

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

      <AdminMarketPricingControlPlaneEditor
        policies={state.policies}
        oneOffPrices={state.oneOffPrices}
        entitlements={state.entitlements}
      />

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
