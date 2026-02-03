import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";
import { HelpCopyBlock } from "@/components/help/HelpCopyBlock";

export const dynamic = "force-dynamic";

export default function VerificationPlaybook() {
  return (
    <HelpPageShell
      title="Verification issues"
      subtitle="Resolve phone, bank, and identity verification questions."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Verification" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">When to use this playbook</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>OTP start/confirm failures.</li>
          <li>Bank verification questions or admin override.</li>
          <li>Identity pill expectations (email + phone).</li>
          <li>&quot;Verified pending&quot; confusion.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Intake checklist</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>User email and role.</li>
          <li>Verification step that failed.</li>
          <li>Time of issue and device.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Quick checks</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Confirm email and phone verification flags.</li>
          <li>Check for recent OTP attempts and rate limits.</li>
          <li>Verify bank status if requested.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Step-by-step diagnosis</h2>
        <HelpStepList
          steps={[
            "Confirm verification status in the user profile.",
            "Check if OTP requests are rate-limited or failing.",
            "If bank verification is needed, confirm admin override status.",
            "Communicate clear next steps to the user.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Likely causes</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="OTP start or confirm fails"
            cause="Rate limit or carrier delivery issue."
            check="Ask user to retry after a short wait."
            fix="Suggest using a different number if possible."
          />
          <HelpIssueCard
            issue="Bank marked verified by admin"
            cause="Manual override needed for plan upgrades."
            check="Confirm admin verification action log."
            fix="Mark verified and notify the user."
          />
          <HelpIssueCard
            issue="Identity pill not showing verified"
            cause="Email or phone not confirmed."
            check="Verify both email and phone flags."
            fix="Guide user through remaining verification steps."
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Escalation rules</h2>
        <HelpCallout variant="warn" title="Escalate when">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>OTP failures occur across multiple providers.</li>
            <li>Verification flags do not update after a confirmed action.</li>
          </ul>
        </HelpCallout>
        <HelpCopyBlock title="Ticket template">
          User email + role:
          
          Verification step + timestamp:
          
          Evidence (screenshots/logs):
        </HelpCopyBlock>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Resolution template</h2>
        <HelpCopyBlock title="Message to user">
          We reviewed your verification status. Please retry the verification step. If you continue to see an error, we
          can help with a manual review.
        </HelpCopyBlock>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Login & access", href: "/help/admin/support-playbooks/login-access" },
          { label: "Legal & terms", href: "/help/admin/support-playbooks/legal" },
        ]}
      />
    </HelpPageShell>
  );
}
