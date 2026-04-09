import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpCopyBlock } from "@/components/help/HelpCopyBlock";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";

export const dynamic = "force-dynamic";

export default function MoveReadyServicesPlaybookPage() {
  return (
    <HelpPageShell
      title="Move & Ready Services"
      subtitle="Internal pilot playbook for curated provider routing, unmatched handling, and expansion discipline."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Move & Ready Services" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">When to use this playbook</h2>
        <p className="text-sm text-slate-600">
          Use this playbook when reviewing Move &amp; Ready pilot requests, provider readiness, or
          weekly pilot scorecards across landlord, host, and agent requesters.
        </p>
        <HelpCallout variant="warn" title="Keep the wedge narrow">
          Do not use this pilot to justify tenant requester expansion, removals, payments, or a public
          services marketplace.
        </HelpCallout>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Daily operator checklist</h2>
        <HelpStepList
          steps={[
            "Review all new requests and sort unmatched requests first.",
            "Check lead delivery failures before approving new providers.",
            "Pause low-response providers quickly instead of letting the queue degrade.",
            "Ensure every unmatched request older than two business days has a named follow-up owner.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Pilot validation gates</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="Go"
            cause="The wedge is matching and providers are responding."
            check="At least 15 requests, 70%+ match rate, 60%+ provider response rate, and controlled ops burden."
            fix="Keep scope fixed and prepare one narrow hardening or expansion batch."
          />
          <HelpIssueCard
            issue="Iterate"
            cause="Demand exists but routing or response quality is weak."
            check="50-69% match rate, 35-59% provider response rate, or growing unmatched backlog."
            fix="Improve copy, provider coverage, and routing discipline before any scope expansion."
          />
          <HelpIssueCard
            issue="Pause / rework"
            cause="The wedge is creating more drag than value."
            check="Match rate below 50%, response rate below 35%, or unmatched backlog older than two business days above 5."
            fix="Pause expansion and rework ops/process first."
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Escalate immediately when</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>provider response rate drops below 35 percent in a week</li>
          <li>lead delivery failures exceed 15 percent</li>
          <li>requests are repeatedly submitted outside the three allowed categories</li>
          <li>ops cannot clear unmatched requests within two business days</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Weekly memo format</h2>
        <HelpCopyBlock title="Decision memo fields">
          Pilot period:

          Active geography:

          Submitted requests:

          Match rate:

          Provider response rate:

          Unmatched backlog older than two business days:

          Decision: go / iterate / pause
        </HelpCopyBlock>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Admin services hub", href: "/admin/services" },
          { label: "Support playbooks", href: "/help/admin/support-playbooks" },
          { label: "Analytics guide", href: "/help/admin/analytics" },
        ]}
      />
    </HelpPageShell>
  );
}
