import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";
import { HelpCopyBlock } from "@/components/help/HelpCopyBlock";

export const dynamic = "force-dynamic";

export default function IntakeTriagePlaybook() {
  return (
    <HelpPageShell
      title="Intake & triage"
      subtitle="First-response checklist to classify, prioritize, and route support incidents."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Intake & triage" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">When to use this playbook</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Any new support request without a clear category.</li>
          <li>Incidents affecting multiple users or a key workflow.</li>
          <li>Unclear severity or incomplete user reports.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Intake checklist</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>User email and role (tenant, landlord, agent, admin).</li>
          <li>Environment (production vs preview), page URL, and device.</li>
          <li>Time of issue and any screenshots or recordings.</li>
          <li>Request ID from logs if available.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Quick checks (fast fixes)</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Confirm the user is logged in and on the correct role dashboard.</li>
          <li>Check whether the issue is limited to preview or production.</li>
          <li>Verify the listing or user record exists and is active.</li>
          <li>Ask the user to try again after clearing cache if it is UI-only.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Step-by-step diagnosis</h2>
        <HelpStepList
          steps={[
            "Classify the issue type (access, listings, messaging, payments, analytics).",
            "Determine severity: P0 (platform down), P1 (core flow blocked), P2 (degraded).",
            "Reproduce the issue using the same role or a test account.",
            "Check admin tools for status or obvious misconfigurations.",
            "Collect evidence and move to the relevant playbook.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Likely causes</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="User blocked from core flow"
            cause="Role mismatch or expired session."
            check="Confirm role and session in profile records."
            fix="Guide the user to re-login or correct role assignment."
          />
          <HelpIssueCard
            issue="Multiple users impacted"
            cause="Configuration or backend incident."
            check="Confirm if other reports exist and look for error spikes."
            fix="Escalate with evidence and disable risky operations if needed."
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Escalation rules</h2>
        <HelpCallout variant="warn" title="Escalate to engineering when">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>Issue blocks core flows for multiple users.</li>
            <li>Data loss, payment failures, or security concerns are suspected.</li>
            <li>Errors are reproducible and not resolved by quick checks.</li>
          </ul>
        </HelpCallout>
        <HelpCopyBlock title="Ticket template">
          Summary:
          
          Impacted users/roles:
          
          Steps to reproduce:
          
          Expected vs actual:
          
          Environment (prod/preview) + URL:
          
          Request ID / logs:
        </HelpCopyBlock>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Resolution template</h2>
        <HelpCopyBlock title="Message to user">
          Thanks for reporting this. We reviewed your account and confirmed the issue. We’re actively working on a fix and
          will update you as soon as it’s resolved. If anything changes on your side, please let us know.
        </HelpCopyBlock>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Login & access", href: "/help/admin/support-playbooks/login-access" },
          { label: "Listings", href: "/help/admin/support-playbooks/listings" },
          { label: "Messaging", href: "/help/admin/support-playbooks/messaging" },
        ]}
      />
    </HelpPageShell>
  );
}
