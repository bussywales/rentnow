import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";
import { HelpCopyBlock } from "@/components/help/HelpCopyBlock";

export const dynamic = "force-dynamic";

export default function LoginAccessPlaybook() {
  return (
    <HelpPageShell
      title="Login & access issues"
      subtitle="Handle auth errors, role mismatches, and session problems without breaking access."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Login & access" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">When to use this playbook</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>User can&apos;t log in or keeps getting redirected.</li>
          <li>Role mismatch (tenant seeing host pages or vice versa).</li>
          <li>Errors like missing_user or auth required loops.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Intake checklist</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>User email and role.</li>
          <li>Exact URL and the redirect target.</li>
          <li>Time of issue and device/browser.</li>
          <li>Screenshot and requestId if available.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Quick checks</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Confirm the user&apos;s profile has the correct role.</li>
          <li>Ask the user to log out and log back in.</li>
          <li>Check domain mismatch (propatyhub.com vs preview).</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Step-by-step diagnosis</h2>
        <HelpStepList
          steps={[
            "Verify the user exists and the role is correct in profiles.",
            "Reproduce the login flow with the same role in a clean session.",
            "Check for missing_user logs on protected routes.",
            "Confirm legal/terms acceptance status if a loop occurs.",
            "If on preview, confirm cookies are set for the right domain.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Likely causes</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="Wrong redirect after login"
            cause="Role mismatch or stale redirect query param."
            check="Confirm role and the redirect URL."
            fix="Clear redirect param and guide user to the correct dashboard."
          />
          <HelpIssueCard
            issue="missing_user in logs"
            cause="Session cookie not set or expired."
            check="Ask user to log out and log back in; check domain."
            fix="Clear cookies and re-authenticate."
          />
          <HelpIssueCard
            issue="Terms acceptance loop"
            cause="Legal acceptance not persisted or missing audience mapping."
            check="Verify legal acceptance records for the user."
            fix="Ask user to accept again; escalate if acceptance doesn&apos;t persist."
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Escalation rules</h2>
        <HelpCallout variant="warn" title="Escalate when">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>Role data is correct but redirects continue to fail.</li>
            <li>Missing_user errors appear across multiple users.</li>
            <li>Terms acceptance loops persist after retries.</li>
          </ul>
        </HelpCallout>
        <HelpCopyBlock title="Ticket template">
          User email + role:
          
          Redirect URL + expected dashboard:
          
          Evidence (screenshots/logs/requestId):
          
          Steps to reproduce:
        </HelpCopyBlock>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Resolution template</h2>
        <HelpCopyBlock title="Message to user">
          We&apos;ve reviewed your access and corrected the login path. Please log out, clear browser cookies, and log in again.
          If the issue continues, let us know the exact page you land on and we&apos;ll investigate further.
        </HelpCopyBlock>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Legal playbook", href: "/help/admin/support-playbooks/legal" },
          { label: "Intake & triage", href: "/help/admin/support-playbooks/intake-triage" },
        ]}
      />
    </HelpPageShell>
  );
}
