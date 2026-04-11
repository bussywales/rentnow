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
        <HelpCallout variant="warn" title="Current sign-off status: Not ready for final sign-off">
          Billing and payments are not yet ready for a clean final sign-off. Nigeria is now truthfully represented as a
          provider-backed market, but it is still running in test mode. The Stripe path is still blocked for the
          intended live subscription markets because Stripe is set to live mode while the active runtime does not have a
          live Stripe secret for the account holding the canonical GB/CA/US price refs.
        </HelpCallout>
        <p className="text-sm text-slate-600">
          Use this page as the current operational truth. Historical update notes record intended milestones, but they
          are not the final operational sign-off document.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Market-by-market truth</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpCopyBlock title="United Kingdom — Not ready for sign-off">
            Provider: Stripe

            Currency: GBP

            Roles / cadences: tenant, landlord, and agent on monthly and yearly rows

            Subscription truth: canonical Stripe rows exist and are intended to be live.

            PAYG truth: separate listing PAYG path still exists for listing monetisation, but it is not the primary
            subscription execution path.

            Runtime truth: Stripe mode is live, but the active runtime does not have a retrievable live Stripe secret
            for the account that holds the canonical UK price refs. Runtime therefore resolves as unavailable instead
            of ready.

            Admin matrix truth: truthful. The matrix surfaces canonical runtime plus checkout mismatch / runtime
            unavailable instead of pretending the market is healthy.
          </HelpCopyBlock>
          <HelpCopyBlock title="Canada — Not ready for sign-off">
            Provider: Stripe

            Currency: CAD

            Roles / cadences: tenant, landlord, and agent on monthly and yearly rows

            Subscription truth: repo truth expects final CAD Stripe rows, and the active CA landlord yearly canonical row
            has been corrected back to the intended final price ref.

            PAYG truth: separate listing PAYG path is available where listing-credit rules apply, but it does not solve
            subscription readiness.

            Runtime truth: Stripe mode is live, but the active runtime does not have a retrievable live Stripe secret
            for the account that holds the canonical CA price refs.

            Admin matrix truth: truthful. It shows the market as misaligned/unavailable rather than complete.
          </HelpCopyBlock>
          <HelpCopyBlock title="United States — Not ready for sign-off">
            Provider: Stripe

            Currency: USD

            Roles / cadences: tenant, landlord, and agent on monthly and yearly rows

            Subscription truth: canonical USD Stripe rows exist in repo and in the DB, but they are not usable under the
            current live Stripe configuration.

            PAYG truth: separate listing PAYG path still exists for listing monetisation, but it is not the primary
            subscription execution path.

            Runtime truth: Stripe mode is live, but the active runtime does not have a retrievable live Stripe secret
            for the account that holds the canonical US price refs, so runtime is blocked at checkout.

            Admin matrix truth: truthful. The matrix reflects checkout mismatch and runtime unavailable instead of
            calling the market complete.
          </HelpCopyBlock>
          <HelpCopyBlock title="Nigeria — Not ready for sign-off">
            Provider: Paystack-backed runtime

            Currency: NGN

            Roles / cadences: tenant, landlord, and agent on monthly and yearly rows

            Subscription truth: canonical NG rows exist and intentionally point to a provider-backed local payment path
            rather than a Stripe recurring price ref.

            PAYG truth: PAYG listing fees remain available as a separate listing monetisation path and are not the same
            as subscription execution.

            Runtime truth: the matrix and runtime agree that Nigeria is healthy as a provider-backed market. Checkout is
            intentionally routed through Paystack, and a blank Stripe-style provider ref is not an error.

            Sign-off blocker: current Paystack mode is test, and Flutterwave is not configured. Nigeria is therefore an
            operator-safe provider-backed path, but it is not ready for final live-market billing sign-off.
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
            "Open the role billing page and confirm the user-facing state matches the matrix truth for the selected market.",
            "For listing monetisation, confirm PAYG remains available where listing-credit rules expect it and does not conflict with subscription messaging.",
            "Do not call billing signed off until completed markets show clean runtime checkout and intentionally constrained markets are labelled as constrained, not complete.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Boardroom-safe internal summary</h2>
        <HelpCallout variant="warn" title="Leadership answer today">
          Billing and payments are not yet ready for a clean final sign-off.
        </HelpCallout>
        <HelpCopyBlock title="What is complete vs constrained vs blocked">
          Complete enough to understand operationally:

          Nigeria now has truthful provider-backed runtime semantics. Operators can explain why a missing Stripe ref is
          not the problem there and why the market is intentionally local-provider-backed.

          Intentionally constrained:

          Nigeria is still in test-mode provider operation and is not part of the live commercial promise yet.

          Blocked:

          United Kingdom, Canada, and United States cannot be signed off while Stripe remains in live mode without a
          usable live Stripe secret for the account holding the canonical price refs.

          Also not ready:

          Nigeria should not be called signed off while Paystack remains in test mode.

          Move-on decision:

          Do not claim billing and payments are fully signed off yet. The honest current statement is that billing admin
          truth is much cleaner, but final market execution sign-off is still blocked by Stripe environment/data
          alignment.
        </HelpCopyBlock>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Exact blockers</h2>
        <HelpCopyBlock title="These are the blockers to final sign-off">
          1. Stripe is set to live mode, but the active runtime does not have a usable live Stripe secret for the
          account that holds the canonical GB, CA, and US recurring price refs. Runtime therefore resolves those
          markets as unavailable.

          2. Nigeria is operationally truthful but still constrained to Paystack test mode, and Flutterwave is not
          configured.

          Smallest safe closure batch after this:

          - align the live Stripe environment/account so the canonical Stripe price refs are retrievable
          - move Nigeria to an explicit live provider posture if it is part of the live commercial promise
          - rerun the matrix and billing-page checks, then replace this page’s decision block with a signed-off state
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
