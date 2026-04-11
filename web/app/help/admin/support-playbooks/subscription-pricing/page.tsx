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
      title="Subscription pricing control plane"
      subtitle="Internal guide for editing canonical subscription pricing safely without ad hoc migrations."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Subscription pricing" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Canonical pricing truth</h2>
        <p className="text-sm text-slate-600">
          PropatyHub canonical pricing is the source of truth. Stripe recurring price objects are execution refs attached to that truth.
          Change the canonical price here first, then bind the Stripe ref that matches it.
        </p>
        <HelpCallout variant="info" title="What publish means">
          Publish activates a new canonical row. It does not edit a live Stripe price in place. Old rows stay in history so the team can trace previous values.
        </HelpCallout>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Safe price change flow</h2>
        <HelpStepList
          steps={[
            "Create or update a draft for the market, role, and cadence you want to change.",
            "Set the canonical currency and amount that the business wants to charge.",
            "Attach the matching Stripe recurring price ref.",
            "Publish only when the draft shows as publish-ready.",
            "Confirm the active matrix row is aligned after publish.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">How to read statuses</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="Active"
            cause="The canonical row is live and matches runtime checkout truth."
            check="Amount, currency, provider, and linked Stripe ref all line up."
            fix="No action needed unless pricing is changing again."
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
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Stripe refs in MVP</h2>
        <HelpCopyBlock title="Important scope note">
          This MVP removes the need for Codex on normal Stripe-backed subscription price changes.

          Stripe recurring price creation can still be partly operational. Once the correct Stripe ref exists, admins can attach it, save a draft, and publish from inside PropatyHub.

          Paystack and Flutterwave subscription execution are out of scope for this first control-plane batch.
        </HelpCopyBlock>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Admin pricing control plane", href: "/admin/settings/billing/prices" },
          { label: "Billing settings", href: "/admin/settings/billing" },
          { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        ]}
      />
    </HelpPageShell>
  );
}
