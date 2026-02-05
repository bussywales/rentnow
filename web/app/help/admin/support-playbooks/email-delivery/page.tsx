import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";

export const dynamic = "force-dynamic";

export default function EmailDeliveryPlaybook() {
  return (
    <HelpPageShell
      title="Email delivery & limits"
      subtitle="Diagnose rate limits and delivery gaps for auth emails and help users recover quickly."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Email delivery & limits" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Symptoms</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>User says “I never received the email” (signup, reset, magic link).</li>
          <li>Repeated resend clicks with no delivery.</li>
          <li>Supabase errors mentioning rate limit or email quota.</li>
          <li>Login loops after a user tries to accept terms or reset password.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Root causes</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="Supabase free email limits exceeded"
            cause="Default provider enforces a low daily quota; repeated resends exhaust it."
            check="Review auth logs or recent spikes in resend attempts."
            fix="Enable Custom SMTP with a dedicated provider."
          />
          <HelpIssueCard
            issue="User resends repeatedly"
            cause="Multiple attempts in a short window."
            check="Ask user if they clicked resend multiple times."
            fix="Explain cooldown and ask them to wait before retrying."
          />
          <HelpIssueCard
            issue="Emails land in spam"
            cause="Missing or incorrect SPF/DKIM/DMARC."
            check="Verify sender domain DNS records."
            fix="Publish SPF/DKIM/DMARC and wait for DNS propagation."
          />
          <HelpIssueCard
            issue="Wrong sender address"
            cause="SMTP configured but sender is not verified."
            check="Confirm the from address in Supabase Auth settings."
            fix="Use a verified sender and re-test."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Fix checklist (Custom SMTP)</h2>
        <HelpStepList
          steps={[
            "Open Supabase → Auth → Email and enable Custom SMTP.",
            "Use a dedicated provider (Resend, SendGrid, or Mailgun).",
            "Set a verified sender address (e.g., support@propatyhub.com).",
            "Add SPF and DKIM records from your provider.",
            "Add a DMARC record for stronger deliverability.",
            "Send a test email and confirm it arrives in the inbox (not spam).",
          ]}
        />
        <HelpCallout variant="info" title="DNS propagation">
          Allow 15–60 minutes for DNS changes to propagate before re-testing deliverability.
        </HelpCallout>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">What we implemented in-app</h2>
        <HelpCallout variant="success" title="Cooldown behavior">
          Resend buttons now enforce a 60-second cooldown after every send attempt (success or error),
          keyed by email + action, with a visible countdown.
        </HelpCallout>
        <p className="text-sm text-slate-600">
          If Supabase returns a rate-limit error, users see a friendly message telling them to wait and
          retry later.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Troubleshooting</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Check spam/junk folders and “Promotions” tabs.</li>
          <li>Verify sender domain and DNS records (SPF/DKIM/DMARC).</li>
          <li>Ensure the sender address matches the configured SMTP identity.</li>
          <li>If still blocked, ask for the timestamp and email address, then escalate.</li>
        </ul>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Login & access playbook", href: "/help/admin/support-playbooks/login-access" },
          { label: "Legal & terms playbook", href: "/help/admin/support-playbooks/legal" },
          { label: "Product updates playbook", href: "/help/admin/support-playbooks/product-updates" },
        ]}
      />
    </HelpPageShell>
  );
}
