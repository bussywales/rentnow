import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";
import { HelpCopyBlock } from "@/components/help/HelpCopyBlock";

export const dynamic = "force-dynamic";

export default function LegalPlaybook() {
  return (
    <HelpPageShell
      title="Legal & terms issues"
      subtitle="Handle legal acceptance, document access, and admin deadlocks safely."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Legal & terms" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">When to use this playbook</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>/legal not loading or exports failing.</li>
          <li>Acceptance missing for a user or audience.</li>
          <li>Admin blocked by terms loops.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Intake checklist</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>User email and role.</li>
          <li>Document ID (if known).</li>
          <li>Exact error message or screenshot.</li>
          <li>Time of acceptance attempt.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Quick checks</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Confirm the document is published, not draft-only.</li>
          <li>Verify the user&apos;s required audience is correct.</li>
          <li>Check if acceptance exists already.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Step-by-step diagnosis</h2>
        <HelpStepList
          steps={[
            "Locate the legal document in Admin → Legal.",
            "Confirm it is published and assigned to the right audience.",
            "Check acceptance logs for the user.",
            "If acceptance is missing, guide the user to re-accept.",
            "Avoid admin deadlocks by confirming admin audience exceptions.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Likely causes</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="/legal not loading"
            cause="Document unpublished or missing audience mapping."
            check="Verify published status and audience."
            fix="Publish the document or adjust audience."
          />
          <HelpIssueCard
            issue="Exports failing"
            cause="Storage or permission issue."
            check="Retry export from Admin → Legal."
            fix="Escalate if repeated failures occur."
          />
          <HelpIssueCard
            issue="Acceptance missing"
            cause="User never completed acceptance or record failed to persist."
            check="Search acceptance logs for the user." 
            fix="Ask user to accept again; escalate if it does not persist." 
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Escalation rules</h2>
        <HelpCallout variant="warn" title="Escalate when">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>Published documents are not visible to the correct audience.</li>
            <li>Acceptance persists incorrectly after retries.</li>
            <li>Admin users are blocked due to terms loops.</li>
          </ul>
        </HelpCallout>
        <HelpCopyBlock title="Ticket template">
          User email + role:
          
          Document ID + audience:
          
          Evidence (screenshots/logs):
        </HelpCopyBlock>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Resolution template</h2>
        <HelpCopyBlock title="Message to user">
          We reviewed the legal document settings and restored access. Please revisit the legal page and complete
          acceptance. If you see the same error, reply with a screenshot.
        </HelpCopyBlock>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Login & access", href: "/help/admin/support-playbooks/login-access" },
          { label: "Product updates", href: "/help/admin/support-playbooks/product-updates" },
        ]}
      />
    </HelpPageShell>
  );
}
