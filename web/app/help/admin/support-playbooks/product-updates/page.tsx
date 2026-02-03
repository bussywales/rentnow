import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";
import { HelpCopyBlock } from "@/components/help/HelpCopyBlock";

export const dynamic = "force-dynamic";

export default function ProductUpdatesPlaybook() {
  return (
    <HelpPageShell
      title="Product updates issues"
      subtitle="Resolve unread mismatches, drawer issues, and upload failures."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Product updates" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">When to use this playbook</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Unread badge shows but drawer is empty.</li>
          <li>Read-all not persisting or count mismatch.</li>
          <li>Drawer overlay z-index issues.</li>
          <li>Image upload failures (storage bucket).</li>
          <li>Onboarding not showing “since last visit”.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Intake checklist</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>User email + role.</li>
          <li>Update ID (if known) and audience.</li>
          <li>Screenshot of bell and drawer state.</li>
          <li>Timestamp of last seen update.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Quick checks</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Confirm updates are published for the user’s audience.</li>
          <li>Verify unread count endpoint returns expected value.</li>
          <li>Check storage bucket for image uploads.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Step-by-step diagnosis</h2>
        <HelpStepList
          steps={[
            "Check the update record is published and audience matches the user.",
            "Verify the user’s read records and unread count.",
            "Test drawer rendering on a known good account.",
            "Confirm storage bucket permissions for image uploads.",
            "If overlay is behind content, test on /admin/users and /tenant/home.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Likely causes</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="Unread badge but empty drawer"
            cause="Audience mismatch or unpublished update."
            check="Confirm update audience and published_at."
            fix="Publish to the correct audience or update filters."
          />
          <HelpIssueCard
            issue="Read-all not persisting"
            cause="Read records not created or cached response."
            check="Inspect read records for the user."
            fix="Retry read-all and ensure response is successful."
          />
          <HelpIssueCard
            issue="Overlay z-index issue"
            cause="Drawer not portalled or stacking context conflict."
            check="Open drawer on admin pages with sticky headers."
            fix="Ensure drawer overlay is on top and backdrop covers the page."
          />
          <HelpIssueCard
            issue="Image upload failed"
            cause="Storage bucket missing or permissions misconfigured."
            check="Verify the product-updates bucket exists."
            fix="Create bucket and retry upload."
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Escalation rules</h2>
        <HelpCallout variant="warn" title="Escalate when">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>Unread counts are incorrect for multiple users.</li>
            <li>Drawer fails to render across roles.</li>
            <li>Storage uploads fail after bucket verification.</li>
          </ul>
        </HelpCallout>
        <HelpCopyBlock title="Ticket template">
          User email + role:
          
          Update ID + audience:
          
          Evidence (screenshots/logs):
        </HelpCopyBlock>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Resolution template</h2>
        <HelpCopyBlock title="Message to user">
          We reviewed the update feed and refreshed your unread status. Please open the updates drawer again. If the issue
          persists, reply with a screenshot and we will investigate further.
        </HelpCopyBlock>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Product updates admin", href: "/admin/product-updates" },
          { label: "Intake & triage", href: "/help/admin/support-playbooks/intake-triage" },
        ]}
      />
    </HelpPageShell>
  );
}
