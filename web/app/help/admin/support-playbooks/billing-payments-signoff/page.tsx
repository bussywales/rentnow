import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpCopyBlock } from "@/components/help/HelpCopyBlock";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";

export const dynamic = "force-dynamic";

export default function BillingPaymentsSignoffPage() {
  return (
    <HelpPageShell
      title="Billing and payments sign-off"
      subtitle="Current operational sign-off pack for subscriptions, provider-backed checkout, and PAYG billing truth."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Billing and payments sign-off" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Decision</h2>
        <HelpCallout variant="info" title="Current sign-off status: Signed off with explicit constraints">
          Billing and payments are operationally stable enough to move on. United Kingdom, Canada, and the United
          States are aligned on canonical Stripe truth and live runtime execution. Nigeria is truthfully represented as
          a provider-backed Paystack market, but it remains an explicitly constrained test-mode lane rather than part
          of the live Stripe commercial promise.
        </HelpCallout>
        <p className="text-sm text-slate-600">
          Use this page as the current operational truth. Historical update notes record intended milestones, but they
          are not the final operational sign-off document.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Market-by-market truth</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpCopyBlock title="United Kingdom — Signed off">
            Provider: Stripe

            Currency: GBP

            Roles / cadences: tenant, landlord, and agent on monthly and yearly rows

            Subscription truth: canonical Stripe rows exist and are intended to be live.

            PAYG truth: separate listing PAYG path still exists for listing monetisation, but it is not the primary
            subscription execution path.

            Runtime truth: live Stripe runtime is aligned to the PropatyHub Stripe account, and representative
            canonical UK price refs are retrievable.

            Admin matrix truth: truthful. The matrix and runtime agree on a healthy canonical Stripe subscription lane.
          </HelpCopyBlock>
          <HelpCopyBlock title="Canada — Signed off">
            Provider: Stripe

            Currency: CAD

            Roles / cadences: tenant, landlord, and agent on monthly and yearly rows

            Subscription truth: repo truth expects final CAD Stripe rows, and the active CA landlord yearly canonical
            row now matches the intended final price ref.

            PAYG truth: separate listing PAYG path is available where listing-credit rules apply, but it does not solve
            subscription readiness.

            Runtime truth: live Stripe runtime is aligned to the PropatyHub Stripe account, and representative
            canonical CA price refs are retrievable.

            Admin matrix truth: truthful. The matrix and runtime agree on a healthy canonical CAD Stripe lane.
          </HelpCopyBlock>
          <HelpCopyBlock title="United States — Signed off">
            Provider: Stripe

            Currency: USD

            Roles / cadences: tenant, landlord, and agent on monthly and yearly rows

            Subscription truth: canonical USD Stripe rows exist in repo and in the DB and are aligned to the live
            Stripe account used by production runtime.

            PAYG truth: separate listing PAYG path still exists for listing monetisation, but it is not the primary
            subscription execution path.

            Runtime truth: live Stripe runtime is aligned to the PropatyHub Stripe account, and representative
            canonical US price refs are retrievable.

            Admin matrix truth: truthful. The matrix and runtime agree on a healthy canonical USD Stripe lane.
          </HelpCopyBlock>
          <HelpCopyBlock title="Nigeria — Signed off with constraints">
            Provider: Paystack-backed runtime

            Currency: NGN

            Roles / cadences: tenant, landlord, and agent on monthly and yearly rows

            Subscription truth: canonical NG rows exist and intentionally point to a provider-backed local payment path
            rather than a Stripe recurring price ref.

            PAYG truth: PAYG listing fees remain available as a separate listing monetisation path and are not the same
            as subscription execution.

            Runtime truth: the matrix and runtime agree that Nigeria is healthy as a provider-backed market. Checkout is
            intentionally routed through Paystack, and a blank Stripe-style provider ref is not an error.

            Constraint: Paystack mode remains test, and Flutterwave is not configured. Nigeria is therefore an
            operator-safe provider-backed path, but it is not part of the live Stripe-backed commercial promise.
          </HelpCopyBlock>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Operator checklist</h2>
        <HelpStepList
          steps={[
            "Confirm provider modes first: Stripe, Paystack, and Flutterwave must match the intended live or test state.",
            "Open the pricing control plane and confirm every active market row shows the expected provider, currency, and role/cadence coverage.",
            "For Stripe-backed markets, confirm the matrix does not show checkout mismatch, runtime unavailable, or cross-currency diagnostics.",
            "For non-Stripe markets, confirm the matrix explains provider-backed runtime or provider fallback explicitly rather than showing a fake Missing ref error.",
            "Open the role billing page and confirm the user-facing payment mode badge matches the selected market provider, not a different provider's mode.",
            "For listing monetisation, confirm PAYG remains available where listing-credit rules expect it and does not conflict with subscription messaging.",
            "Only classify a market as Signed off with constraints when the operator and stakeholder wording make the constraint explicit and non-misleading.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Boardroom-safe internal summary</h2>
        <HelpCallout variant="info" title="Leadership answer today">
          Billing and payments are signed off with explicit constraints.
        </HelpCallout>
        <HelpCopyBlock title="What is complete vs constrained vs blocked">
          Complete enough to understand operationally:

          United Kingdom, Canada, and the United States are complete Stripe-backed subscription markets. Canonical
          price-book truth, runtime checkout truth, and admin matrix truth now line up.

          Intentionally constrained:

          Nigeria is an intentionally provider-backed Paystack lane. It is operationally truthful and operator-safe, but
          it remains in test mode and is not part of the live Stripe subscription promise.

          Move-on decision:

          It is safe to say billing and payments are signed off with explicit constraints. Move on from billing feature
          work, but keep Nigeria framed as a constrained provider-backed market until Paystack is intentionally moved to
          live mode.
        </HelpCopyBlock>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Residual constraints</h2>
        <HelpCopyBlock title="These are the remaining non-blocking constraints">
          1. Nigeria remains provider-backed and test-mode through Paystack. That is an explicit commercial constraint,
          not a broken Stripe lane.

          2. Flutterwave is not configured and is not part of the current live promise.

          3. Local development still uses a Stripe test account in `.env.local`. That is acceptable for dev, but it is
          not evidence about production runtime truth.

          This does not block billing sign-off for the live Stripe markets. It does mean stakeholder messaging must keep
          Nigeria framed as constrained rather than fully live.
        </HelpCopyBlock>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Admin pricing control plane", href: "/admin/settings/billing/prices" },
          { label: "Subscription pricing SOP", href: "/help/admin/support-playbooks/subscription-pricing" },
          { label: "Subscription pricing audit log", href: "/admin/settings/billing/prices/history" },
          { label: "Billing settings", href: "/admin/settings/billing" },
        ]}
      />
    </HelpPageShell>
  );
}
