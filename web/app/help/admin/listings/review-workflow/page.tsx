import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";

export const dynamic = "force-dynamic";

export default function ListingsReviewWorkflowPage() {
  return (
    <div data-testid="help-listings-review-workflow">
      <HelpPageShell
        title="Listings review workflow"
        subtitle="Use this checklist to keep decisions consistent, tenant-friendly, and auditable."
        breadcrumbs={[
          { label: "Help Centre", href: "/help" },
          { label: "Listings", href: "/help/admin/listings" },
          { label: "Review workflow" },
        ]}
      >
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">When to use this</h2>
          <p className="text-sm text-slate-600">
            Use this workflow when a listing is submitted for review, when a host requests reactivation, or when a listing
            is flagged by trust or support. This guide applies to rentals and sales listings.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Where to find it in the app</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
            <li>Admin dashboard: Review queue shows new submissions and changes requested.</li>
            <li>Admin listings: search by title, owner, status, or featured state.</li>
            <li>Host detail pages show the owner context if a decision needs follow-up.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Review checklist</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
            <li>Title is clear, tenant-friendly, and avoids all-caps or hype wording.</li>
            <li>Price matches the rent period or sale intent and is within the expected market range.</li>
            <li>Location is precise (city, neighborhood) without exposing a private address.</li>
            <li>Listing type, rental type, and intent align (rent vs buy).</li>
            <li>Bedrooms, bathrooms, and amenities match the description and photos.</li>
            <li>Photos are bright, recent, and show the main living spaces (minimum 4 photos when possible).</li>
            <li>Cover photo is clear and not a logo, map, or low-resolution image.</li>
            <li>House rules and availability details are complete enough to set expectations.</li>
            <li>Trust cues are present (verified host signals if available) and not misleading.</li>
            <li>Featured listings are live and not paused or expired.</li>
            <li>Any warnings or previous rejections are resolved with clear updates.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Step-by-step workflow</h2>
          <HelpStepList
            steps={[
              "Open the listing in the Review queue and scan the summary metadata.",
              "Check listing intent, price, location, and media against the checklist.",
              "Verify photos match the claimed property type and size.",
              "Confirm the listing status is appropriate (pending, under review, changes requested).",
              "If issues exist, select Request changes and provide a concise reason.",
              "If the listing meets standards, approve and set it to Live.",
              "If the listing is unsafe or violates policy, reject with a clear reason.",
              "Log any escalations or unusual cases in the admin notes.",
            ]}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Statuses and definitions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {
              [
                ["Draft", "Listing is incomplete and not submitted."],
                ["Pending / Submitted", "Waiting for initial review."],
                ["Under review", "Being actively evaluated by admin."],
                ["Live", "Publicly visible in search and browse."],
                ["Paused (Owner hold)", "Hidden from public; owner paused for personal reasons."],
                ["Paused (Occupied)", "Hidden from public; tenant moved in or deal in progress."],
                ["Changes requested", "Requires host updates before re-review."],
                ["Rejected", "Fails requirements; not eligible to go live."],
                ["Expired", "Listing lapsed and needs renewal."],
              ].map(([label, description]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">{label}</p>
                  <p className="mt-1 text-xs text-slate-600">{description}</p>
                </div>
              ))
            }
          </div>
          <p className="text-xs text-slate-500">
            Featured listings must be Live. Featured but paused or expired listings never show in tenant discovery.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Common issues and fixes</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <HelpIssueCard
              issue="Photos are too dark or blurry"
              cause="Low quality uploads or missing daylight photos."
              check="Scan the gallery for visibility and room coverage."
              fix="Request higher quality images; suggest cover photo replacement."
              escalate="If repeated after 2 requests, flag for content moderation."
            />
            <HelpIssueCard
              issue="Price seems unrealistic"
              cause="Manual input error or wrong rent period."
              check="Compare with similar listings in the same city or building."
              fix="Request correction and clarify rent period in notes."
            />
            <HelpIssueCard
              issue="Location data looks inconsistent"
              cause="Map pin or neighborhood mismatch."
              check="Compare city/state with the map preview and address fields."
              fix="Request the host to update location details or re-pin."
            />
            <HelpIssueCard
              issue="Listing appears duplicated"
              cause="Host re-listed without archiving the old entry."
              check="Search for similar titles or identical photos from the same owner."
              fix="Ask host to archive the old listing and keep one active record."
            />
            <HelpIssueCard
              issue="Verification cues missing"
              cause="Host has not completed phone, email, or bank verification."
              check="Review host verification status in the user profile."
              fix="Request completion before approving or apply changes requested."
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Escalate when</h2>
          <HelpCallout variant="warn" title="Escalate only after checklist completion">
            <ul className="list-disc space-y-2 pl-5 text-sm">
              <li>Safety or fraud indicators appear in the listing details.</li>
              <li>The host disputes a decision without providing new evidence.</li>
              <li>Listing content conflicts with legal or policy guidance.</li>
            </ul>
          </HelpCallout>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Related links</h2>
          <HelpRelatedLinks
            links={[
              {
                label: "Listings hub",
                href: "/help/admin/listings",
                description: "Overview of listings docs and quick actions.",
              },
              {
                label: "Statuses",
                href: "/help/admin/listings/statuses",
                description: "Reference for status meanings and transitions.",
              },
              {
                label: "Featured listings",
                href: "/help/admin/listings/featured",
                description: "How to feature inventory and read performance metrics.",
              },
            ]}
          />
        </section>
      </HelpPageShell>
    </div>
  );
}
