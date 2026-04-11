import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpCopyBlock } from "@/components/help/HelpCopyBlock";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";

export const dynamic = "force-dynamic";

export default function SubscriptionPricingPlaybookPage() {
  return (
    <HelpPageShell
      title="Subscription pricing SOP"
      subtitle="Internal operating procedure for changing canonical subscription pricing safely from the control plane."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Subscription pricing SOP" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">What this page is for</h2>
        <p className="text-sm text-slate-600">
          The pricing control plane is where the business changes live subscription pricing safely. PropatyHub is the canonical
          pricing truth. Stripe recurring price objects are execution refs attached to that truth. Do not start price changes in
          Stripe and do not treat Stripe as the pricing brain.
        </p>
        <HelpCallout variant="info" title="What publish means">
          Publish activates a new canonical row. It does not edit a live Stripe price in place. Old rows stay in history so the
          team can trace previous values and rollouts.
        </HelpCallout>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Safe subscription price change flow</h2>
        <HelpStepList
          steps={[
            "Confirm Stripe mode first. Make sure you are working in the intended live or test environment before touching any draft.",
            "Find the current live row for the market, role, and cadence you want to change so you know exactly what will be replaced.",
            "Create or update a draft with the new canonical amount and currency the business wants to charge.",
            "Create and bind the matching Stripe recurring price from the draft, or attach the ref manually only if it already exists and matches the draft exactly.",
            "Validate alignment. The row must not be missing a Stripe ref, blocked, or misaligned before publish.",
            "Publish only when the row is clearly safe and marked as ready to go live.",
            "Verify the result in three places: the active matrix row, the role billing page, and Stripe itself.",
          ]}
        />
        <HelpCallout variant="info" title="Non-Stripe markets use a different execution path">
          Nigeria and any other provider-backed market still use the canonical price book as pricing truth, but checkout is executed by the local provider instead of by a Stripe recurring price ref. For those rows, Provider-backed runtime is healthy and Provider-managed in the ref column is expected.
        </HelpCallout>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Status meanings</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="Active"
            cause="The canonical row is live and matches runtime checkout truth."
            check="Amount, currency, provider, and linked Stripe ref all line up."
            fix="No action needed unless pricing is changing again."
          />
          <HelpIssueCard
            issue="Draft"
            cause="The row is being prepared but is not live."
            check="Use this state to confirm amount, currency, cadence, and provider data before publish."
            fix="Create or bind the correct Stripe recurring price, then move it to a publish-ready state."
          />
          <HelpIssueCard
            issue="Pending publish"
            cause="The draft is complete but not live yet."
            check="Linked Stripe recurring price matches canonical amount and currency."
            fix="Publish when the release timing is right."
          />
          <HelpIssueCard
            issue="Missing Stripe ref"
            cause="Canonical draft exists but no Stripe recurring price is attached."
            check="Draft has amount/currency but provider ref is blank."
            fix="Create the Stripe recurring price and attach its ref before publish."
          />
          <HelpIssueCard
            issue="Misaligned / blocked"
            cause="The linked Stripe recurring price does not match canonical truth or cannot be validated safely."
            check="Mismatch between canonical amount/currency and Stripe price snapshot."
            fix="Correct the draft or attach the correct Stripe recurring price ref, then retry."
          />
          <HelpIssueCard
            issue="Archived"
            cause="This row was previously live or draft truth but has been superseded."
            check="Archived rows stay visible so the team can trace old pricing decisions."
            fix="Do not reactivate archived rows casually. Create a fresh draft if pricing needs to change again."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Operator status legend</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpCopyBlock title="Healthy / good">
            Aligned means the live row and checkout truth match cleanly.

            Canonical runtime means checkout is using the canonical row as intended.

            Provider-backed runtime means the canonical amount is live and checkout is intentionally being executed by Paystack or Flutterwave for that market.

            Superseded row history means you are looking at traceable history, not an active problem.
          </HelpCopyBlock>
          <HelpCopyBlock title="In progress / operator action may still be needed">
            Pending publish means the draft is complete enough to go live, but publish has not happened yet.

            Missing ref means the draft still needs a Stripe recurring price ref before it is safe to publish.
          </HelpCopyBlock>
          <HelpCopyBlock title="Warning / fix needed">
            Cross-currency canonical means the canonical row is present but currency alignment is not clean.

            Provider fallback in use means runtime found a different local payment provider than the canonical row expected.

            Checkout mismatch means runtime checkout truth does not match the canonical row.

            Misaligned means the draft or live row is linked to a Stripe ref that does not match its canonical terms.
          </HelpCopyBlock>
          <HelpCopyBlock title="Blocking / unsafe">
            Runtime unavailable means checkout cannot safely resolve a usable price.

            Blocked means the row must not be published or relied on until the underlying issue is fixed.
          </HelpCopyBlock>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Hard rules</h2>
        <HelpCopyBlock title="Important scope note">
          Never start in Stripe. Start from the canonical draft in PropatyHub.

          Never publish rows that are missing a Stripe ref, blocked, or misaligned.

          Never reuse a stale Stripe price after the amount, currency, or cadence changes. Save the draft again and create a fresh Stripe price that matches the new canonical terms.

          Always confirm live or test mode first. A correct draft in the wrong mode is still an operational mistake.
        </HelpCopyBlock>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">When missing canonical rows are a real problem</h2>
        <HelpCopyBlock title="Treat the matrix according to the execution model">
          A missing canonical row is a real problem when the market is supposed to sell from canonical subscription truth and runtime checkout cannot explain the row cleanly.

          A non-Stripe market is not broken just because there is no Stripe recurring price ref. If the matrix shows Provider-backed runtime with the correct amount, currency, and local provider, the row is intentionally sellable through that provider path.

          Treat fallback runtime as a warning. It means checkout found a workable path, but operators should still confirm whether that fallback is expected for the market.
        </HelpCopyBlock>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">When to stop and escalate</h2>
        <HelpCopyBlock title="Pause the rollout and get help when:">
          Stop if the Stripe product looks wrong, the created Stripe price does not validate against the draft, the row stays blocked after a clean bind, or the role billing page still shows the old live amount after publish.

          Escalate if live and test mode look mixed, if more than one plan family appears to map to the same Stripe product unexpectedly, or if the active matrix and runtime billing page disagree.
        </HelpCopyBlock>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">How to use activity and history</h2>
        <HelpCopyBlock title="Use the right history surface for the job">
          Recent pricing activity on the main control-plane page is only a compact summary of the latest events.

          The full audit log is the complete bounded history view for cross-market and cross-role investigation.

          Row history is the filtered lane view for one market, role, and cadence. Use it when you need lineage for a specific pricing row without scanning the whole ledger.
        </HelpCopyBlock>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Admin pricing control plane", href: "/admin/settings/billing/prices" },
          { label: "Billing and payments sign-off", href: "/help/admin/support-playbooks/billing-payments-signoff" },
          { label: "Subscription pricing audit log", href: "/admin/settings/billing/prices/history" },
          { label: "Billing settings", href: "/admin/settings/billing" },
          { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        ]}
      />
    </HelpPageShell>
  );
}
