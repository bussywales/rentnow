import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";

export const dynamic = "force-dynamic";

export default function ListingsFeaturedHelpPage() {
  return (
    <HelpPageShell
      title="Featured listings"
      subtitle="Operational guidance for boosting listings safely and explaining featured performance."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Listings", href: "/help/admin/listings" },
        { label: "Featured" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">What featured listings are</h2>
        <p className="text-sm text-slate-600">
          Featured listings are an admin-controlled boost that highlights select LIVE listings in tenant discovery. They
          are used to promote high-quality inventory, balance supply in priority cities, and surface trusted hosts.
        </p>
        <p className="text-sm text-slate-600">
          Featured listings appear ahead of regular listings in curated modules and can receive a small ordering bias in
          search results. They do not override listing eligibility rules or guarantee demand.
        </p>
        <HelpCallout variant="info" title="Featured listings are a boost, not a guarantee">
          Featured listings are an administrative boost tool, not a guarantee of leads or bookings.
        </HelpCallout>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Where featured listings appear</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Tenant view</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Tenant discovery landing modules (Featured homes).</li>
              <li>Featured carousels on /tenant/home.</li>
              <li>Search results ordering bias when featured is active.</li>
              <li>“Why this home is featured” note on the listing card/detail.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Host view</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Host sees featured status in their listings management.</li>
              <li>Performance metrics surface in the host analytics view.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Admin view</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Featured inventory panel in Admin → Listings.</li>
              <li>Featured filters (active, expiring soon, expired).</li>
              <li>Performance summary for impressions, clicks, and leads.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">How to feature a listing</h2>
        <HelpStepList
          steps={[
            "Go to Admin → Listings and open the listing detail drawer.",
            "Toggle Featured on.",
            "Set a rank (lower number = higher priority).",
            "Set a Featured until date to avoid stale boosts.",
            "Save and confirm the listing remains Live.",
          ]}
        />
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Changes apply immediately to tenant discovery modules.</li>
          <li>When the until date passes, the listing is automatically removed from Featured.</li>
          <li>If two listings share a rank, the most recently updated listing surfaces first.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Featured ranking logic</h2>
        <p className="text-sm text-slate-600">
          Featured ranking is a priority queue: lower rank numbers are shown first. Listings with no rank are placed after
          ranked items. Expired featured listings are filtered out automatically.
        </p>
        <HelpCallout variant="warn" title="Eligibility rules still apply">
          Featured ranking affects visibility but does not override listing eligibility rules (status, approval, expiry).
        </HelpCallout>
        <p className="text-sm text-slate-600">
          If an admin forgets to unfeature a listing, the until date ensures it drops out of featured modules on time.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Performance and metrics</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Impressions: how many times the featured card was rendered.</li>
          <li>Views: clicks that lead to the listing detail page.</li>
          <li>Saves: tenant wishlist toggles.</li>
          <li>Leads: enquiries or viewing requests attributable to featured exposure.</li>
          <li>CTR (if shown): views divided by impressions.</li>
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Where to see it</h3>
            <p className="mt-2 text-sm text-slate-600">
              Use Admin → Listings → Featured inventory panel for weekly snapshots. Host performance pages show a compact
              summary for each listing.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">How to explain results</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>“Featured increases exposure, but leads still depend on pricing and media quality.”</li>
              <li>“We can adjust rank or refresh photos to improve conversion.”</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Common support scenarios</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="Why is my listing not featured anymore?"
            cause="Featured until date passed or listing is no longer Live."
            check="Confirm status is Live and the featured_until timestamp is in the future."
            fix="Set a new until date and confirm it appears in the Featured panel."
            escalate="Escalate only if featured flag is true but listing is still missing from modules."
          />
          <HelpIssueCard
            issue="I paid for a boost but don’t see results"
            cause="Featured exposure is active but conversion drivers are weak (price, photos, location)."
            check="Review impressions, views, saves, and lead counts."
            fix="Recommend better media, pricing adjustments, or a higher rank."
          />
          <HelpIssueCard
            issue="My listing was featured but then disappeared"
            cause="Listing status changed to paused/expired or until date passed."
            check="Verify listing status and featured_until in Admin → Listings."
            fix="Reactivate listing or extend featured_until if eligible."
          />
          <HelpIssueCard
            issue="Can I be featured while paused?"
            cause="Paused listings are ineligible for featured placement."
            check="Confirm current status and pause reason."
            fix="Explain that listings must be Live to be featured."
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Rules and guardrails</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Only admins can feature listings.</li>
          <li>Hosts and agents cannot self-feature.</li>
          <li>Featured listings must be Live.</li>
          <li>Featured does not bypass review, expiry, or pause rules.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Related links</h2>
        <HelpRelatedLinks
          links={[
            { label: "Listings overview", href: "/help/admin/listings/overview" },
            { label: "Listings statuses", href: "/help/admin/listings/statuses" },
            { label: "Analytics", href: "/help/admin/analytics" },
            { label: "Support playbooks", href: "/help/admin/support-playbooks" },
          ]}
        />
      </section>
    </HelpPageShell>
  );
}
