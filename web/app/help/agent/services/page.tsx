import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";

export const dynamic = "force-dynamic";

export default function AgentServicesHelpPage() {
  return (
    <HelpPageShell
      title="Move & Ready Services for agents"
      subtitle="How agents use the same narrow property-prep pilot without expanding it into a broader services product."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Agent help", href: "/help/agent" },
        { label: "Move & Ready Services" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">What agents can do in this pilot</h2>
        <p className="text-sm text-slate-600">
          Agents can request end-of-tenancy cleaning, fumigation, or minor repairs for their own
          portfolio context or an active delegated landlord portfolio.
        </p>
        <HelpCallout variant="info" title="Still a narrow pilot">
          This does not open tenant requests, removals, provider browsing, scheduling, or payments.
        </HelpCallout>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">How to use it</h2>
        <HelpStepList
          steps={[
            "Open Prep Services from the workspace sidebar or the overview cards.",
            "If you are acting for a landlord, keep the delegated portfolio selected before opening the request form.",
            "Submit a short request for one of the three pilot categories only.",
            "Check the request page to see whether providers were matched or whether ops still needs to route it manually.",
          ]}
        />
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Open prep requests", href: "/host/services" },
          { label: "Start a prep request", href: "/host/services/new" },
          { label: "Core pilot guide", href: "/help/host/services" },
        ]}
      />
    </HelpPageShell>
  );
}
