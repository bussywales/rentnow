import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";

export const dynamic = "force-dynamic";

export default function TrendingHelpPage() {
  return (
    <HelpPageShell
      title="How Trending works"
      subtitle="Trending rails highlight listings with strong recent activity."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Trending" },
      ]}
    >
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Ranking formula</h2>
          <p className="mt-1 text-sm text-slate-600">
            We rank listings using privacy-safe activity from the last 7 days:
            views + (saves × 4). Listings need at least a minimum activity score before
            they appear.
          </p>
        </section>
        <section>
          <h3 className="text-base font-semibold text-slate-900">What data is used</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Recent view activity.</li>
            <li>Recent saves/shortlist activity.</li>
            <li>No personal profile data is shown on these rails.</li>
          </ul>
        </section>
        <p className="text-xs text-slate-500">
          PropatyHub is a marketplace. Always verify viewing details before paying.
        </p>
        <HelpRelatedLinks
          links={[
            { label: "Trust badges explained", href: "/help/trust" },
            { label: "Browse homes", href: "/properties" },
          ]}
        />
      </div>
    </HelpPageShell>
  );
}

