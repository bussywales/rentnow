import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";

export const dynamic = "force-dynamic";

function DefinitionCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
    </div>
  );
}

export default function StakeholderDashboardDefinitionsPage() {
  return (
    <HelpPageShell
      title="Stakeholder dashboard definitions"
      subtitle="Plain-English definitions for the PH Stakeholder Traction Dashboard so the team can read the numbers consistently."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Analytics", href: "/help/admin/analytics" },
        { label: "Stakeholder dashboard definitions" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">What this page is for</h2>
        <p className="text-sm text-slate-600">
          This page explains what the stakeholder dashboard means, where the numbers come from, and what the dashboard
          can and cannot tell you on its own.
        </p>
        <HelpCallout variant="info" title="Read the dashboard in layers">
          Start with acquisition, then demand, then billing, then host activation. Do not jump straight from traffic to
          business conclusions without checking the next stage of the funnel.
        </HelpCallout>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Core executive metrics</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DefinitionCard title="Sessions" body="Visits recorded in GA4. A single person can create more than one session." />
          <DefinitionCard title="Total Users" body="Distinct users reported by GA4 for the selected period." />
          <DefinitionCard title="New Users" body="People GA4 classifies as first-time users in the selected period." />
          <DefinitionCard
            title="High-Intent Actions"
            body="Strong demand signals from first-party events, mainly property requests published, contact submissions, and viewing requests submitted."
          />
          <DefinitionCard
            title="Successful Checkouts"
            body="Completed subscription checkouts recorded from the first-party billing funnel, not just people who opened checkout."
          />
          <DefinitionCard
            title="Paid Landlords"
            body="Successful checkouts where the converting user role is landlord."
          />
          <DefinitionCard
            title="Paid Agents"
            body="Successful checkouts where the converting user role is agent."
          />
          <DefinitionCard
            title="Live Listings"
            body="Listings currently in a live state inside the platform. This is an operational platform metric, not a traffic metric."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Acquisition page terms</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <DefinitionCard
            title="Landing Page"
            body="The first page a visit arrived on. Use this to see whether campaign traffic is entering through the pages you intended."
          />
          <DefinitionCard
            title="Source / Medium"
            body="Where the visit came from and what type of channel it was, such as `facebook / paid_social` or `google / organic`."
          />
          <DefinitionCard
            title="Campaign"
            body="The campaign name attached to tagged traffic. This helps separate one paid push or launch effort from another."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Tenant demand page terms</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DefinitionCard title="Listing Views" body="Times a property detail page was opened. This is stronger than an impression because the user chose to inspect the listing." />
          <DefinitionCard title="Result Clicks" body="Clicks from a search or browse results surface into a listing. This helps show whether discovery surfaces are producing interest." />
          <DefinitionCard title="Property Requests Published" body="Published property requests from users actively expressing housing demand." />
          <DefinitionCard title="High-Intent Actions" body="The strongest demand actions. These are more meaningful than views alone because the user took a next-step action." />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Billing conversion page terms</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DefinitionCard title="Billing Page Views" body="Visits to the billing page. This is the first visible billing-funnel step, not a purchase." />
          <DefinitionCard title="Plans Selected" body="Times a user chose a plan option before checkout began. This is intent, not payment." />
          <DefinitionCard title="Checkout Starts" body="Times checkout was successfully initiated. This is stronger than plan selection, but it still does not mean payment completed." />
          <DefinitionCard title="Successful Checkouts" body="Completed checkouts confirmed by the first-party billing flow. This is the billing conversion metric to trust most." />
          <DefinitionCard title="Role" body="The user type attached to the conversion, such as tenant, landlord, or agent." />
          <DefinitionCard title="Cadence" body="Monthly or yearly plan cadence. Use this to see whether conversion is concentrated in one billing interval." />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Source of truth</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">GA4 metrics</h3>
            <p className="mt-2 text-sm text-slate-600">
              Use GA4 for sessions, users, new users, source / medium, campaign, and landing-page reporting.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              These are acquisition metrics. They are useful for seeing where traffic comes from and whether campaigns
              are driving visits.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">First-party SQL / internal events</h3>
            <p className="mt-2 text-sm text-slate-600">
              Use first-party events for listing views, high-intent actions, billing conversion, paid-host metrics, and
              live-listing counts.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              These are closer to product and operational truth than GA4 for downstream actions.
            </p>
          </div>
        </div>
        <HelpCallout variant="warn" title="Do not mix denominators casually">
          GA4 session metrics and first-party event counts come from different systems. Treat them as related signals,
          not automatically interchangeable bases for conversion math.
        </HelpCallout>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Directional: acquisition trends, landing-page shifts, early-funnel attention.</li>
            <li>Operationally exact enough: successful checkouts, paid landlords, paid agents, live listings.</li>
            <li>Interpret with care: sparse early-stage traffic, thin campaign volume, and blended GA4-to-SQL comparisons.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">How to read this dashboard</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>Start with acquisition: are the right channels and landing pages bringing in traffic?</li>
            <li>Then check demand: are visits turning into listing views and high-intent actions?</li>
            <li>Then check billing: are serious users moving from billing page view to successful checkout?</li>
            <li>Then check host activation: are paid hosts actually creating and publishing live listings?</li>
          </ol>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <DefinitionCard
            title="What a rising metric might imply"
            body="A rise can mean better channel quality, stronger offer fit, or stronger product clarity. It does not automatically prove profitability or retention."
          />
          <DefinitionCard
            title="What a falling metric might imply"
            body="A fall can point to weaker traffic quality, tracking gaps, lower supply quality, weaker conversion copy, or simply low-volume noise in an early rollout."
          />
        </div>
        <HelpCallout variant="info" title="What this dashboard is useful for">
          It is useful for spotting demand shape, conversion friction, supply activation, and channel quality quickly.
        </HelpCallout>
        <HelpCallout variant="warn" title="What this dashboard does not prove on its own">
          It does not prove channel profitability, long-term retention, or fulfillment quality by itself. Those need
          follow-up analysis and context.
        </HelpCallout>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Common misreads and cautions</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
            <li>A high session count does not automatically mean high-quality demand.</li>
            <li>Acquisition metrics and first-party event metrics come from different systems and should not be blended casually.</li>
            <li>Zero successful checkouts in an early rollout can reflect very low volume, not necessarily a broken product.</li>
            <li>Sparse data in the first days or weeks should be interpreted carefully.</li>
            <li>Strong listing views with weak high-intent actions usually mean curiosity, not yet real demand.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Related links</h2>
        <HelpRelatedLinks
          links={[
            {
              label: "Analytics guide",
              href: "/help/admin/analytics",
              description: "Admin-facing analytics QA and interpretation guide.",
            },
            {
              label: "Reporting assembly plan",
              href: "/help/admin/support-playbooks/analytics",
              description: "Operational analytics playbook and reporting context.",
            },
            {
              label: "Admin analytics hub",
              href: "/admin/analytics",
              description: "The internal analytics workspace entry point.",
            },
          ]}
        />
      </section>
    </HelpPageShell>
  );
}
