import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";

export const dynamic = "force-dynamic";

export default function AnalyticsHelpPage() {
  return (
    <HelpPageShell
      title="Analytics, demand, and performance"
      subtitle="How to interpret demand signals, explain results to hosts, and make evidence-based decisions."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Analytics" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Why analytics matter</h2>
        <p className="text-sm text-slate-600">
          Analytics in PropatyHub are intent signals, not vanity metrics. We track real demand and engagement to support
          hosts, keep listings healthy, and justify featured placements.
        </p>
        <HelpCallout variant="info" title="Analytics inform decisions">
          Analytics help explain what is happening, not guarantee outcomes.
        </HelpCallout>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Events and signals tracked</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Exposure (passive)</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Impressions — listing shown to tenants.</li>
              <li>Featured impressions — featured card rendered on discovery.</li>
              <li>Shares — share links opened.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Interest (active)</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Views — listing opened.</li>
              <li>Saves — tenant wishlist signal.</li>
              <li>Clicks from featured modules (if available).</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Conversion</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Leads — enquiries or messages.</li>
              <li>Viewing requests — scheduled intent.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Where admins see analytics</h2>
        <HelpStepList
          steps={[
            "Admin listings table shows summary metrics (recent views, saves, leads).",
            "Supply health table surfaces listing quality scores and missing basics.",
            "Featured inventory panel shows impressions, CTR, and leads for boosted listings.",
            "Host performance page shows listing-level demand and missed demand.",
            "Missed demand indicators appear when listings are paused or expired.",
          ]}
        />
        <p className="text-sm text-slate-600">
          Recent 7-day signals matter more than lifetime totals. Use short windows to spot changes quickly and act fast.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Supply health quality score (0–100)</h2>
        <p className="text-sm text-slate-600">
          Supply health scoring highlights listings missing the basics. It is used internally to prioritize fixes; it
          does not block listings or change review outcomes.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">What improves the score</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Photos: 1+ photos (baseline), 4+ (strong), 8+ (excellent).</li>
              <li>Title: 20+ characters with clear specifics.</li>
              <li>Description: 120+ characters explaining features and fit.</li>
              <li>Price: price + currency set.</li>
              <li>Location: city or pinned area present.</li>
              <li>Listing intent selected (rent/lease or sale).</li>
              <li>Status: Live listings score higher than draft/paused.</li>
              <li>Verified host bonus (email + phone).</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">How to use it</h3>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Use the flags to guide host outreach (“missing price”, “few photos”).</li>
              <li>Low score + high views with no enquiries → start with price and photos.</li>
              <li>Low score + low views → improve title/location clarity first.</li>
            </ul>
            <HelpCallout variant="info" title="Scoring is guidance">
              Scores are not visible to tenants and do not affect ranking directly.
            </HelpCallout>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Missed demand</h2>
        <p className="text-sm text-slate-600">
          Missed demand estimates the demand a listing could have captured while paused or expired. It combines recent
          unique views, saves, and leads to show what might be missed if the listing stayed live.
        </p>
        <HelpCallout variant="warn" title="Missed demand is a signal, not a loss">
          Missed demand does not mean lost revenue, but it signals timing and pricing opportunities.
        </HelpCallout>
        <p className="text-sm text-slate-600">
          Example: a listing was paused during a period when similar listings received multiple saves. That suggests the
          host could benefit from reactivation or pricing adjustments.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Featured performance metrics</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Impressions uplift: how often the listing is shown.</li>
          <li>CTR: click-through rate from featured modules.</li>
          <li>Leads vs non-featured baseline: are enquiries improving?</li>
          <li>Featured does not guarantee leads; it increases exposure.</li>
        </ul>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">When to recommend unfeaturing</h3>
          <p className="mt-2 text-sm text-slate-600">
            If a listing has high impressions but consistently low engagement (views, saves, leads), recommend refreshing
            media or pricing first. If performance remains low after updates, unfeature and rotate inventory.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Sample response: “Featured visibility is working, but tenants are not converting. Let’s refresh photos and
            price, then re-evaluate in a week.”
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Common admin decisions</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="High views, low leads"
            cause="Listing is visible but not compelling (pricing or media mismatch)."
            check="Compare price to similar listings, review photo quality, verify location accuracy."
            fix="Recommend price adjustment or updated photos and resurface later."
            escalate="Escalate only if data looks wrong or events are missing."
          />
          <HelpIssueCard
            issue="Low impressions"
            cause="Listing is not live, featured expired, or demand is low in the city."
            check="Confirm status is Live and featured_until is active if featured."
            fix="Recommend a new featured slot or ensure listing meets discovery requirements."
          />
          <HelpIssueCard
            issue="Many saves, no enquiries"
            cause="Tenants are interested but hesitant to contact."
            check="Review description clarity, amenities, and host response profile."
            fix="Suggest improved details or a proactive response strategy."
          />
          <HelpIssueCard
            issue="Good performance but low conversion"
            cause="Listing gets attention but loses out to better alternatives."
            check="Compare to competing listings; verify pricing and availability."
            fix="Recommend a more competitive price or availability update."
          />
          <HelpIssueCard
            issue="Featured but underperforming"
            cause="Featured exposure is active but listing quality is below competitors."
            check="Review CTR and leads against other featured listings."
            fix="Refresh listing content or unfeature to rotate stronger inventory."
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">What analytics should NOT be used for</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Do not promise outcomes or guaranteed leads.</li>
          <li>Do not compare listings across very different locations unfairly.</li>
          <li>Do not override review or status rules based on metrics alone.</li>
          <li>Do not encourage misrepresentation to improve metrics.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Related links</h2>
        <HelpRelatedLinks
          links={[
            { label: "Featured listings", href: "/help/admin/listings/featured" },
            { label: "Listings statuses", href: "/help/admin/listings/statuses" },
            { label: "Support playbooks", href: "/help/admin/support-playbooks" },
            { label: "Product updates", href: "/help/admin/product-updates" },
          ]}
        />
      </section>
    </HelpPageShell>
  );
}
