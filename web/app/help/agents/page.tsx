import Link from "next/link";

const SECTION_CARDS: Array<{
  id: string;
  title: string;
  description: string;
  links: Array<{ label: string; href: string }>;
}> = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Understand your workspace, profile setup, and daily flow.",
    links: [
      { label: "Agent getting started", href: "/help/agents/articles/agent-getting-started" },
      { label: "Browse all help articles", href: "/help/articles" },
    ],
  },
  {
    id: "referrals",
    title: "Referrals",
    description: "Invite, activate, and grow tiers with clear milestone rules.",
    links: [
      { label: "Referrals FAQ", href: "/help/referrals#for-agents-hosts" },
      {
        label: "How to share your referral link",
        href: "/help/agents/articles/how-to-share-your-referral-link",
      },
      {
        label: "Understanding Active referrals",
        href: "/help/agents/articles/understanding-active-referrals",
      },
    ],
  },
  {
    id: "listings-publishing",
    title: "Listings & publishing",
    description: "Publish clean listings and improve discovery quality.",
    links: [
      { label: "How to publish a listing", href: "/help/agents/articles/how-to-publish-a-listing" },
      { label: "Creating demo listings", href: "/help/agents/articles/creating-demo-listings" },
    ],
  },
  {
    id: "viewings-leads",
    title: "Viewings & leads",
    description: "Handle enquiries and follow-up workflows with less friction.",
    links: [
      {
        label: "How to request viewings / respond to leads",
        href: "/help/agents/articles/how-to-request-viewings-and-respond-to-leads",
      },
    ],
  },
  {
    id: "saved-searches-alerts",
    title: "Saved searches & alerts",
    description: "Track demand and follow relevant listings quickly.",
    links: [
      {
        label: "Saved searches & alerts guide",
        href: "/help/agents/articles/saved-searches-and-alerts",
      },
    ],
  },
  {
    id: "credits-billing",
    title: "Credits & billing",
    description: "Use credits confidently and understand billing boundaries.",
    links: [{ label: "How to use credits", href: "/help/agents/articles/how-to-use-credits" }],
  },
  {
    id: "safety-reporting",
    title: "Safety & reporting",
    description: "Protect your account and report suspicious behavior.",
    links: [{ label: "Troubleshooting common issues", href: "/help/agents/articles/troubleshooting-common-issues" }],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    description: "Fix common blockers with clear checks.",
    links: [{ label: "Troubleshooting common issues", href: "/help/agents/articles/troubleshooting-common-issues" }],
  },
];

export default function AgentHelpCentrePage() {
  return (
    <div className="space-y-8" data-testid="help-agent-landing">
      <header id="overview" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Agent Help Centre</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Guides for day-to-day execution</h1>
        <p className="mt-2 text-sm text-slate-600">
          Find practical guides for browsing, listings, viewings, saved searches, referrals, and billing.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/help/articles"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Browse all articles
          </Link>
          <Link
            href="/help/referrals#for-agents-hosts"
            className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Referral FAQ
          </Link>
        </div>
      </header>

      <section id="start-here" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Start here</h2>
        <p className="mt-1 text-sm text-slate-600">
          Follow this mental flow: set up profile and listings, respond to leads quickly, share referrals, then
          grow Active referrals and milestones.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Complete profile basics and listing quality checks.</li>
          <li>Publish listings and respond to viewings/leads quickly.</li>
          <li>Share your referral link and monitor Active referrals.</li>
          <li>Use earned credits for listings and featured placements.</li>
        </ol>
      </section>

      <section id="common-tasks" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Most common tasks</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Publish a new listing with complete media and location</li>
          <li>Mark training/sample inventory as demo in listing Basics</li>
          <li>Respond to enquiries and schedule viewings</li>
          <li>Share referral link and track Active referral growth</li>
          <li>Use credits for listing and featured operations</li>
          <li>Troubleshoot access, billing, and visibility issues</li>
        </ul>
      </section>

      <section className="space-y-4">
        {SECTION_CARDS.map((section) => (
          <article key={section.id} id={section.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{section.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section
        id="escalation-checklist"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-amber-900">Escalation checklist</h2>
        <p className="mt-1 text-sm text-amber-900">
          Collect these details before contacting support to speed up resolution.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">
          <li>Workspace role and account email (never share password)</li>
          <li>Page URL and timestamp where issue occurred</li>
          <li>Clear steps to reproduce and expected vs actual result</li>
          <li>Screenshot or short recording where possible</li>
          <li>Any relevant listing IDs, referral code, or request IDs</li>
        </ul>
      </section>
    </div>
  );
}
