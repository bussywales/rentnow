import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";

export const dynamic = "force-dynamic";

export default function HostPerformanceHelpPage() {
  return (
    <HelpPageShell
      title="Performance and insights"
      subtitle="Understand your listing signals and choose improvements that help tenants say yes."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Host performance" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Understanding listing performance</h2>
        <p className="text-sm text-slate-600">
          Performance varies by location, timing, and demand. PropatyHub shows interest signals so you can understand
          what tenants respond to, not to rank or judge your listing.
        </p>
        <HelpCallout variant="info" title="Performance insights are guidance">
          Performance insights help you understand interest — they don&apos;t guarantee enquiries or lets.
        </HelpCallout>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Performance signals we show</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Views — how many people opened your listing.</li>
          <li>Saves — tenants bookmarking to compare later.</li>
          <li>Enquiries — direct messages or buy enquiries.</li>
          <li>Viewing requests — tenants asking to schedule a viewing.</li>
          <li>Shares — when tenants share the listing link.</li>
          <li>Featured exposure — extra visibility when your listing is featured.</li>
          <li>Missed interest while paused — a high-level signal when demand exists during a pause.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">How to read your performance</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="High views, low enquiries"
            cause="Price, listing clarity, or competition is reducing conversion."
            check="Compare your price and photos with similar listings nearby."
            fix="Refresh photos, improve the description, or adjust pricing."
            escalate="If everything looks strong but enquiries are still low, contact support."
          />
          <HelpIssueCard
            issue="Saves but no enquiries"
            cause="Tenants are comparing options or waiting on timing."
            check="Review your availability dates and response time."
            fix="Add clearer details and respond quickly to build confidence."
          />
          <HelpIssueCard
            issue="Low views"
            cause="Demand may be low, or the listing is paused/expired."
            check="Confirm your listing is Live and visible in search."
            fix="If live, add new photos or update your title to increase relevance."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Featured listings: what to expect</h2>
        <p className="text-sm text-slate-600">
          Featured listings receive extra visibility in tenant discovery. This helps more people see your listing, but it
          does not guarantee enquiries.
        </p>
        <p className="text-sm text-slate-600">
          Featured improves exposure, not suitability. The listing still needs great photos, a clear description, and a
          competitive price to convert.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Paused listings and missed interest</h2>
        <p className="text-sm text-slate-600">
          Pausing hides your listing from search. Sometimes tenants are still looking during that time, which can show up
          as missed interest. Reactivating when demand is high can help you capture that attention.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">What you can actively improve</h2>
        <HelpStepList
          steps={[
            "Review pricing against similar listings in your area.",
            "Upload bright, recent photos that show key rooms.",
            "Clarify the description: amenities, rules, and who the space fits best.",
            "Respond quickly to enquiries and viewing requests.",
            "Keep availability accurate so tenants can plan confidently.",
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">What performance is NOT used for</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Your performance does not affect account standing.</li>
          <li>There are no penalties for low demand.</li>
          <li>We don&apos;t automatically demote listings based on performance alone.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">When to contact support</h2>
        <p className="text-sm text-slate-600">
          If your listing is Live but not showing in search, or if metrics appear inaccurate, contact support. If demand is
          low due to market conditions, support can help you adjust your listing but can&apos;t change tenant demand.
        </p>
        <HelpRelatedLinks
          links={[
            { label: "Host listings help", href: "/help/host/listings" },
            { label: "Featured listings (coming soon)", href: "/help/host/featured" },
            { label: "Contact support", href: "/support" },
          ]}
        />
      </section>
    </HelpPageShell>
  );
}
