import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";

export const dynamic = "force-dynamic";

export default function ResendSmtpPlaybook() {
  return (
    <HelpPageShell
      title="Resend SMTP setup"
      subtitle="Configure Resend as the Custom SMTP provider for Supabase Auth and improve deliverability."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Resend SMTP setup" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Why we use Resend</h2>
        <p className="text-sm text-slate-600">
          Supabase default email limits are low and can be exhausted by resend loops. Custom SMTP
          improves reliability and keeps deliverability under our control.
        </p>
        <HelpCallout variant="info" title="Outcome">
          Custom SMTP reduces rate-limit incidents and increases inbox placement.
        </HelpCallout>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Resend setup steps</h2>
        <HelpStepList
          steps={[
            "Verify the PropatyHub domain inside Resend.",
            "Add the provided SPF + DKIM DNS records.",
            "Wait for the domain to show as Verified.",
            "Create a sender (e.g., noreply@propatyhub.com).",
            "Copy the SMTP credentials (host, port, user, password).",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Supabase Custom SMTP steps</h2>
        <HelpStepList
          steps={[
            "Supabase → Auth → Email → enable Custom SMTP.",
            "Paste SMTP host/port/user/password from Resend.",
            "Set the Sender name and Sender email.",
            "Send a test email and confirm inbox delivery.",
          ]}
        />
        <HelpCallout variant="warn" title="Sender address">
          The sender email must match a verified domain (e.g., noreply@propatyhub.com). Mismatched
          senders often cause delivery failures.
        </HelpCallout>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Troubleshooting</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="Domain not verified"
            cause="DNS records not published or still propagating."
            check="Confirm SPF/DKIM records in DNS."
            fix="Wait 15–60 minutes and re-check verification."
          />
          <HelpIssueCard
            issue="SPF/DKIM failing"
            cause="Incorrect record values or DNS conflict."
            check="Compare Resend-provided values with DNS."
            fix="Replace records and re-verify."
          />
          <HelpIssueCard
            issue="Wrong sender email"
            cause="Sender doesn’t match verified domain."
            check="Review Sender email in Supabase Auth settings."
            fix="Update sender to a verified domain."
          />
          <HelpIssueCard
            issue="Emails landing in spam"
            cause="Incomplete domain authentication or low trust."
            check="Verify SPF/DKIM/DMARC and sender reputation."
            fix="Add DMARC and send from a consistent sender."
          />
          <HelpIssueCard
            issue="Too many resend attempts"
            cause="Users clicking resend repeatedly."
            check="Confirm cooldown messaging is visible."
            fix="Ask the user to wait for the 60s cooldown."
          />
        </div>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Email delivery & limits", href: "/help/admin/support-playbooks/email-delivery" },
          { label: "Login & access playbook", href: "/help/admin/support-playbooks/login-access" },
          { label: "Product updates playbook", href: "/help/admin/support-playbooks/product-updates" },
        ]}
      />
    </HelpPageShell>
  );
}
