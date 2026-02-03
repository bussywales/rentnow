import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";
import { HelpCopyBlock } from "@/components/help/HelpCopyBlock";

export const dynamic = "force-dynamic";

export default function ListingsPlaybook() {
  return (
    <HelpPageShell
      title="Listings issues"
      subtitle="Triage listings that are missing, rejected, expired, or paused."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Listings" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">When to use this playbook</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Listing not visible publicly.</li>
          <li>Listing rejected or changes requested questions.</li>
          <li>Listing expired unexpectedly or paused.</li>
          <li>Featured toggle not reflecting.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Intake checklist</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Listing ID, title, and owner email.</li>
          <li>Status shown in host dashboard.</li>
          <li>Exact URL where listing is expected.</li>
          <li>Time window when issue started.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Quick checks</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Confirm listing status (live, pending, paused, expired).</li>
          <li>Check if listing has required media and pricing fields.</li>
          <li>Verify it is not expired or paused.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Step-by-step diagnosis</h2>
        <HelpStepList
          steps={[
            "Open Admin → Listings and locate the listing by ID.",
            "Confirm status, approval flags, and expiry timestamps.",
            "Check rejection or changes requested reasons.",
            "If featured, verify featured_until and rank.",
            "Communicate the next action to the owner.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Likely causes</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="Listing not visible publicly"
            cause="Status is not Live (pending, paused, expired)."
            check="Confirm status and approval flags."
            fix="Guide owner to complete requirements or reactivate."
          />
          <HelpIssueCard
            issue="Rejected or changes requested"
            cause="Quality or policy issues identified in review."
            check="Read rejection notes and checklist issues."
            fix="Share clear steps to resolve and resubmit."
          />
          <HelpIssueCard
            issue="Expired unexpectedly"
            cause="Listing reached its expiry date."
            check="Verify expires_at in listing record."
            fix="Prompt owner to renew and update any stale details."
          />
          <HelpIssueCard
            issue="Featured toggle issues"
            cause="Listing not Live or featured_until expired."
            check="Confirm featured_until and status."
            fix="Reactivate listing or update schedule."
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Escalation rules</h2>
        <HelpCallout variant="warn" title="Escalate when">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>Listing status flips without admin action.</li>
            <li>Live listing is missing from search with no pause/expiry.</li>
            <li>Repeated expiry events occur within the same hour.</li>
          </ul>
        </HelpCallout>
        <HelpCopyBlock title="Ticket template">
          Listing ID + owner email:
          
          Current status + expected status:
          
          Evidence (screenshots/logs):
          
          Steps to reproduce:
        </HelpCopyBlock>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Resolution template</h2>
        <HelpCopyBlock title="Message to owner">
          We reviewed your listing and confirmed it is currently in a non-live status. To make it visible, please complete
          the next action requested. Once updated, we&apos;ll review it again promptly.
        </HelpCopyBlock>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Listings statuses", href: "/help/admin/listings/statuses" },
          { label: "Review workflow", href: "/help/admin/listings/review-workflow" },
          { label: "Featured listings", href: "/help/admin/listings/featured" },
        ]}
      />
    </HelpPageShell>
  );
}
