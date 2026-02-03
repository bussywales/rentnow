import Link from "next/link";

import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";

export const dynamic = "force-dynamic";

const PLAYBOOK_LINKS = [
  { label: "Intake & triage", href: "/help/admin/support-playbooks/intake-triage" },
  { label: "Login & access", href: "/help/admin/support-playbooks/login-access" },
  { label: "Listings", href: "/help/admin/support-playbooks/listings" },
  { label: "Messaging", href: "/help/admin/support-playbooks/messaging" },
  { label: "Sharing", href: "/help/admin/support-playbooks/sharing" },
  { label: "Verification", href: "/help/admin/support-playbooks/verification" },
  { label: "Legal & terms", href: "/help/admin/support-playbooks/legal" },
  { label: "Product updates", href: "/help/admin/support-playbooks/product-updates" },
  { label: "Analytics & events", href: "/help/admin/support-playbooks/analytics" },
  { label: "Featured scheduling", href: "/help/admin/support-playbooks/featured" },
];

export default function SupportPlaybooksLandingPage() {
  return (
    <HelpPageShell
      title="Support escalation playbooks"
      subtitle="Internal SOPs for triage, diagnosis, and consistent resolutions."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks" },
      ]}
    >
      <div className="grid gap-4" data-testid="help-playbooks-landing">
        <HelpCallout variant="info" title="Use these playbooks for consistency">
          Follow the intake checklist, capture evidence, and escalate only after quick checks are complete.
        </HelpCallout>
        <div className="grid gap-3 sm:grid-cols-2">
          {PLAYBOOK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <HelpRelatedLinks
          links={[
            { label: "Listings statuses", href: "/help/admin/listings/statuses" },
            { label: "Featured listings", href: "/help/admin/listings/featured" },
            { label: "Analytics guide", href: "/help/admin/analytics" },
          ]}
        />
      </div>
    </HelpPageShell>
  );
}
