import Link from "next/link";

import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";
import { HelpStatusCard } from "@/components/help/HelpStatusCard";

export const dynamic = "force-dynamic";

const STATUS_ROWS = [
  {
    status: "draft",
    label: "Draft",
    publicVisible: "No",
    ownerVisible: "Yes",
    adminVisible: "Yes",
    action: "Encourage completion and submission.",
  },
  {
    status: "pending",
    label: "Pending",
    publicVisible: "No",
    ownerVisible: "Yes",
    adminVisible: "Yes",
    action: "Queue for review and verify checklist.",
  },
  {
    status: "live",
    label: "Live",
    publicVisible: "Yes",
    ownerVisible: "Yes",
    adminVisible: "Yes",
    action: "Monitor performance and trust cues.",
  },
  {
    status: "rejected",
    label: "Rejected",
    publicVisible: "No",
    ownerVisible: "Yes",
    adminVisible: "Yes",
    action: "Provide clear reason; guide next steps.",
  },
  {
    status: "changes_requested",
    label: "Changes requested",
    publicVisible: "No",
    ownerVisible: "Yes",
    adminVisible: "Yes",
    action: "Wait for edits; re-review on resubmit.",
  },
  {
    status: "paused_owner",
    label: "Paused (Owner hold)",
    publicVisible: "No",
    ownerVisible: "Yes",
    adminVisible: "Yes",
    action: "Confirm owner intent; keep status notes.",
  },
  {
    status: "paused_occupied",
    label: "Paused (Occupied / tenant moved in)",
    publicVisible: "No",
    ownerVisible: "Yes",
    adminVisible: "Yes",
    action: "Track occupancy; advise on reactivation timing.",
  },
  {
    status: "expired",
    label: "Expired",
    publicVisible: "No",
    ownerVisible: "Yes",
    adminVisible: "Yes",
    action: "Prompt renewal or archive if outdated.",
  },
];

export default function ListingsStatusesHelpPage() {
  return (
    <HelpPageShell
      title="Listings statuses"
      subtitle="What every status means, who can trigger it, and what Admin/Ops should do next."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Listings", href: "/help/admin/listings" },
        { label: "Statuses" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Why statuses matter</h2>
        <p className="text-sm text-slate-600">
          Statuses keep the marketplace safe and consistent. They control tenant visibility, guide review priorities, and
          ensure ops actions are auditable. Always pick the smallest, most accurate status that reflects the current
          listing state.
        </p>
      </section>

      <section className="space-y-3" data-testid="help-status-table">
        <h2 className="text-lg font-semibold text-slate-900">Quick reference</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Public</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Typical next action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {STATUS_ROWS.map((row) => (
                <tr key={row.status} className="text-slate-700" data-testid={`help-status-row-${row.status}`}>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {row.label}
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{row.status}</div>
                  </td>
                  <td className="px-4 py-3">{row.publicVisible}</td>
                  <td className="px-4 py-3">{row.ownerVisible}</td>
                  <td className="px-4 py-3">{row.adminVisible}</td>
                  <td className="px-4 py-3 text-slate-600">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Status details</h2>
        <div className="grid gap-6">
          <HelpStatusCard
            status="draft"
            label="Draft"
            meaning="Listing is incomplete and not submitted for review."
            who="Host or Agent"
            triggers={["Host starts a listing but does not submit", "Required fields remain incomplete"]}
            visibility={["Tenants: hidden", "Owners: visible", "Admin: visible"]}
            actions={["Nudge host to finish required fields", "Check if listing was abandoned"]}
            report="Confirm the host expects the listing to be live. If they do, remind them to complete and submit it."
          />
          <HelpStatusCard
            status="pending"
            label="Pending"
            meaning="Listing submitted and waiting for admin review."
            who="Host or System"
            triggers={["Host clicks submit", "Auto-resubmission after changes requested"]}
            visibility={["Tenants: hidden", "Owners: visible with pending badge", "Admin: visible in review queue"]}
            actions={["Review against checklist", "Move to Live or Changes requested", "Leave clear notes"]}
            report="Explain that the listing is in review and provide an ETA based on queue volume."
          />
          <HelpStatusCard
            status="live"
            label="Live"
            meaning="Listing is publicly visible in browse and search."
            who="Admin"
            triggers={["Admin approves a pending listing", "Admin reactivates a paused listing"]}
            visibility={["Tenants: visible", "Owners: visible", "Admin: visible"]}
            actions={["Monitor for trust signals", "Ensure featured listings remain live"]}
            report="Confirm the listing is live and share a direct link. If not visible, check for pauses or expiry."
          />
          <HelpStatusCard
            status="rejected"
            label="Rejected"
            meaning="Listing does not meet requirements and cannot go live as submitted."
            who="Admin"
            triggers={["Safety issues", "Misleading content", "Repeated quality failures"]}
            visibility={["Tenants: hidden", "Owners: visible with rejection reason", "Admin: visible"]}
            actions={["Provide clear, actionable reason", "Invite resubmission if eligible"]}
            report="Share the rejection reason and the exact changes needed to resubmit."
          />
          <HelpStatusCard
            status="changes_requested"
            label="Changes requested"
            meaning="Listing needs edits before it can be reviewed again."
            who="Admin"
            triggers={["Missing photos or details", "Pricing/location mismatches", "Incomplete verification cues"]}
            visibility={["Tenants: hidden", "Owners: visible with requested changes", "Admin: visible"]}
            actions={["List required changes", "Re-review once resubmitted"]}
            report="Let the host know which fields to update and how to resubmit for review."
          />
          <HelpStatusCard
            status="paused_owner"
            label="Paused (Owner hold)"
            meaning="Owner paused the listing; it is not publicly visible."
            who="Host"
            triggers={["Owner takes listing offline", "Seasonal or personal hold"]}
            visibility={["Tenants: hidden", "Owners: visible", "Admin: visible"]}
            actions={["Confirm pause reason", "Advise on reactivation"]}
            report="Confirm the pause reason and share how to reactivate when ready."
          />
          <HelpStatusCard
            status="paused_occupied"
            label="Paused (Occupied / tenant moved in)"
            meaning="Listing is paused because it is occupied or under contract."
            who="Host"
            triggers={["Tenant moved in", "Sale in progress"]}
            visibility={["Tenants: hidden", "Owners: visible", "Admin: visible"]}
            actions={["Track occupancy notes", "Suggest reactivation timeline"]}
            report="Confirm occupancy status and set expectations for when it can return to live."
          />
          <HelpStatusCard
            status="expired"
            label="Expired"
            meaning="Listing lapsed after its active period and is no longer visible."
            who="System"
            triggers={["Automatic expiry job runs", "Listing not renewed"]}
            visibility={["Tenants: hidden", "Owners: visible", "Admin: visible"]}
            actions={["Prompt renewal", "Archive if outdated", "Verify data before reactivation"]}
            report="Explain that the listing expired and ask the host to renew or update details."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">What to do next</h2>
        <HelpStepList
          steps={[
            "Confirm the current status against the quick table above.",
            "Check tenant visibility before responding to any inquiry.",
            "If a change is needed, record a short reason in the admin notes.",
            "Use the review workflow for approvals or changes requested.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Escalation rules</h2>
        <HelpCallout variant="warn" title="Escalate to engineering when">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>Statuses change without an obvious trigger or audit trail.</li>
            <li>Hosts report that a Live listing is missing from tenant search with no pause/expiry.</li>
            <li>Multiple listings flip to Expired unexpectedly in the same hour.</li>
          </ul>
        </HelpCallout>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Related links</h2>
        <HelpRelatedLinks
          links={[
            { label: "Review workflow", href: "/help/admin/listings/review-workflow" },
            { label: "Listings overview", href: "/help/admin/listings/overview" },
            { label: "Featured listings", href: "/help/admin/listings/featured" },
            { label: "Support playbooks", href: "/help/admin/support-playbooks" },
          ]}
        />
        <p className="text-xs text-slate-500">
          Need to link to a specific listing? Use the Admin listings registry and paste the property ID when searching.
        </p>
      </section>

      <p className="text-xs text-slate-400">
        Status labels are displayed in tenant-friendly language. Avoid exposing raw enum strings to customers.
      </p>

      <div className="text-sm text-slate-600">
        <span className="font-semibold">Tip:</span> Use the admin listings registry to filter by status when triaging.
        <Link className="ml-2 text-sm font-semibold text-slate-700 hover:text-slate-900" href="/admin/listings">
          Open listings →
        </Link>
      </div>
    </HelpPageShell>
  );
}
