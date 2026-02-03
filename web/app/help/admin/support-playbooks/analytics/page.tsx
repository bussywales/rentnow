import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";
import { HelpCopyBlock } from "@/components/help/HelpCopyBlock";

export const dynamic = "force-dynamic";

export default function AnalyticsPlaybook() {
  return (
    <HelpPageShell
      title="Analytics & events"
      subtitle="Diagnose missing telemetry, attribution errors, and blank performance pages."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Analytics & events" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">When to use this playbook</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Missing events or zero counts on performance pages.</li>
          <li>Session bootstrap failures.</li>
          <li>Incorrect attribution for featured or leads.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Intake checklist</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>User role + listing ID.</li>
          <li>Time window where data is missing.</li>
          <li>Screenshot of the performance panel.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Quick checks</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Confirm the listing is Live and has recent activity.</li>
          <li>Verify session bootstrap endpoint is reachable.</li>
          <li>Check for event rows in property_events for the listing.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Step-by-step diagnosis</h2>
        <HelpStepList
          steps={[
            "Check property_events for recent entries by listing ID.",
            "Verify session_key generation and dedupe rules.",
            "Confirm attribution logic for featured impressions and clicks.",
            "Reproduce a listing view and confirm it logs a view event.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Likely causes</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="Performance page shows zero"
            cause="Events not logged or filters too strict."
            check="Confirm events exist for the listing and time window."
            fix="Re-run with a wider date range or log a fresh event."
          />
          <HelpIssueCard
            issue="Missing events"
            cause="Session bootstrap failed or logging endpoint unavailable."
            check="Check /api/analytics/session and logs."
            fix="Restore endpoint or session cookie generation."
          />
          <HelpIssueCard
            issue="Incorrect attribution"
            cause="Session key mismatch or timing window exceeded."
            check="Review attribution window and session matching."
            fix="Escalate if attribution logic is incorrect."
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Escalation rules</h2>
        <HelpCallout variant="warn" title="Escalate when">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>No events are logged across multiple listings.</li>
            <li>Session bootstrap errors appear for many users.</li>
            <li>Attribution logic is inconsistent with the documented rules.</li>
          </ul>
        </HelpCallout>
        <HelpCopyBlock title="Ticket template">
          Listing ID + role:
          
          Time window + observed metrics:
          
          Evidence (screenshots/logs):
        </HelpCopyBlock>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Resolution template</h2>
        <HelpCopyBlock title="Message to user">
          We reviewed your analytics data and refreshed the latest signals. Please check again after a few minutes. If the
          metrics remain blank, we&apos;ll investigate further.
        </HelpCopyBlock>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Analytics guide", href: "/help/admin/analytics" },
          { label: "Featured listings", href: "/help/admin/listings/featured" },
        ]}
      />
    </HelpPageShell>
  );
}
