import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";
import { HelpCopyBlock } from "@/components/help/HelpCopyBlock";

export const dynamic = "force-dynamic";

export default function SharingPlaybook() {
  return (
    <HelpPageShell
      title="Sharing issues"
      subtitle="Resolve share link failures, token issues, and redirects."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Sharing" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">When to use this playbook</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>/share/property token invalid or expired.</li>
          <li>Recipient does not land on the property after signup.</li>
          <li>Share link unavailable or revoked.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Intake checklist</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Share token or full link.</li>
          <li>Sender and recipient emails.</li>
          <li>Time of share and any screenshots.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Quick checks</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Confirm listing still exists and is Live.</li>
          <li>Verify token has not been revoked or rotated.</li>
          <li>Ask recipient to open in a fresh browser session.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Step-by-step diagnosis</h2>
        <HelpStepList
          steps={[
            "Validate the share token in admin tools or logs.",
            "Confirm the listing is active and not paused/expired.",
            "Check redirect flow after signup for the recipient.",
            "If token is invalid, rotate or reissue the link.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Likely causes</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="Share token invalid"
            cause="Token expired or revoked."
            check="Confirm token status in logs."
            fix="Generate a new share link."
          />
          <HelpIssueCard
            issue="Recipient not returning after signup"
            cause="Redirect parameter missing or blocked by cookies."
            check="Review redirect URL and login flow."
            fix="Provide the direct listing URL as a fallback."
          />
          <HelpIssueCard
            issue="Share link unavailable"
            cause="Listing no longer live or share disabled."
            check="Verify listing status and share settings."
            fix="Reactivate listing or resend link."
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Escalation rules</h2>
        <HelpCallout variant="warn" title="Escalate when">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>Tokens are valid but resolve to errors.</li>
            <li>Redirects fail across multiple users.</li>
            <li>Share link creation fails in admin tools.</li>
          </ul>
        </HelpCallout>
        <HelpCopyBlock title="Ticket template">
          Share token + listing ID:
          
          Sender/recipient emails:
          
          Steps to reproduce:
          
          Evidence (screenshots/logs):
        </HelpCopyBlock>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Resolution template</h2>
        <HelpCopyBlock title="Message to user">
          We refreshed your share link. Please use the new link below. If you still see an error, let us know and we&apos;ll
          investigate further.
        </HelpCopyBlock>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Messaging playbook", href: "/help/admin/support-playbooks/messaging" },
          { label: "Listings playbook", href: "/help/admin/support-playbooks/listings" },
        ]}
      />
    </HelpPageShell>
  );
}
