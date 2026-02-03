import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";
import { HelpCopyBlock } from "@/components/help/HelpCopyBlock";

export const dynamic = "force-dynamic";

export default function FeaturedPlaybook() {
  return (
    <HelpPageShell
      title="Featured scheduling issues"
      subtitle="Resolve featured toggle, rank, and expiry scheduling issues."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Featured scheduling" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">When to use this playbook</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Featured toggle not sticking.</li>
          <li>Listings not showing in featured modules.</li>
          <li>Unexpected expiry or rank conflicts.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Intake checklist</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Listing ID and title.</li>
          <li>Featured rank and until date.</li>
          <li>Time when the issue started.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Quick checks</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Confirm listing is Live.</li>
          <li>Verify featured_until is in the future.</li>
          <li>Check featured panel for the listing.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Step-by-step diagnosis</h2>
        <HelpStepList
          steps={[
            "Open Admin → Listings and locate the listing.",
            "Confirm is_featured flag and featured_until timestamp.",
            "Check featured rank conflicts with other listings.",
            "Verify listing is not paused or expired.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Likely causes</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="Listing not appearing"
            cause="Listing is paused, expired, or not live."
            check="Confirm listing status and expiry."
            fix="Reactivate listing or adjust featured_until."
          />
          <HelpIssueCard
            issue="Featured expired early"
            cause="featured_until is in the past."
            check="Verify featured_until timestamp."
            fix="Set a new until date."
          />
          <HelpIssueCard
            issue="Rank conflicts"
            cause="Multiple listings share the same rank."
            check="Review featured panel ordering."
            fix="Adjust rank to prioritize the listing."
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Escalation rules</h2>
        <HelpCallout variant="warn" title="Escalate when">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>Featured flag set but listing never appears.</li>
            <li>Featured inventory panel fails to load.</li>
          </ul>
        </HelpCallout>
        <HelpCopyBlock title="Ticket template">
          Listing ID + title:
          
          Featured settings (rank/until):
          
          Evidence (screenshots/logs):
        </HelpCopyBlock>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Resolution template</h2>
        <HelpCopyBlock title="Message to owner">
          We reviewed your featured settings and refreshed your scheduling. Your listing should appear in featured
          placements shortly. If it does not, we&apos;ll investigate further.
        </HelpCopyBlock>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Featured listings guide", href: "/help/admin/listings/featured" },
          { label: "Listings statuses", href: "/help/admin/listings/statuses" },
        ]}
      />
    </HelpPageShell>
  );
}
