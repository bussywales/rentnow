import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";
import { HelpCopyBlock } from "@/components/help/HelpCopyBlock";

export const dynamic = "force-dynamic";

export default function MessagingPlaybook() {
  return (
    <HelpPageShell
      title="Messaging issues"
      subtitle="Resolve blocked exchanges, missing threads, and unread mismatches."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Messaging" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">When to use this playbook</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Contact exchange blocked or missing messages.</li>
          <li>Thread not showing or unread badge mismatch.</li>
          <li>401 missing_user in messaging logs.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Intake checklist</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>User email + role, recipient email if known.</li>
          <li>Property ID or thread ID.</li>
          <li>Exact error or screenshot.</li>
          <li>Time of last successful message.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Quick checks</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Confirm both users exist and are active.</li>
          <li>Verify listing is Live for contact exchange.</li>
          <li>Ask user to refresh or re-open the thread.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Step-by-step diagnosis</h2>
        <HelpStepList
          steps={[
            "Locate the thread via Admin tools or by property ID.",
            "Verify permissions: tenant/host roles and listing visibility.",
            "Check logs for missing_user or rate-limit errors.",
            "Confirm contact exchange rules are satisfied.",
            "Clear unread state if stuck and re-check the thread.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Likely causes</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="Contact exchange blocked"
            cause="Listing not live or trust requirements not met."
            check="Confirm listing status and trust markers."
            fix="Advise host to complete verification or reactivate listing."
          />
          <HelpIssueCard
            issue="Thread not showing"
            cause="Role mismatch or missing thread index."
            check="Search by property and participants."
            fix="Escalate if thread exists but does not render."
          />
          <HelpIssueCard
            issue="Unread badge mismatch"
            cause="Read receipts not synced."
            check="Confirm read status in the thread." 
            fix="Ask user to open thread; refresh counts." 
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Escalation rules</h2>
        <HelpCallout variant="warn" title="Escalate when">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>Messages fail across multiple users.</li>
            <li>Contact exchange blocks even when requirements are met.</li>
            <li>Thread data exists but UI consistently fails to render.</li>
          </ul>
        </HelpCallout>
        <HelpCopyBlock title="Ticket template">
          User email + role:
          
          Property ID / Thread ID:
          
          Error logs / requestId:
          
          Steps to reproduce:
        </HelpCopyBlock>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Resolution template</h2>
        <HelpCopyBlock title="Message to user">
          We checked your message thread and confirmed it is available. Please refresh the thread and try again. If the
          issue continues, we can reset the unread state and follow up with engineering.
        </HelpCopyBlock>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Sharing playbook", href: "/help/admin/support-playbooks/sharing" },
          { label: "Listings playbook", href: "/help/admin/support-playbooks/listings" },
        ]}
      />
    </HelpPageShell>
  );
}
