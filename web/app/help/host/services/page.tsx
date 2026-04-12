import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";

export const dynamic = "force-dynamic";

export default function HostServicesHelpPage() {
  return (
    <HelpPageShell
      title="Move & Ready Services pilot"
      subtitle="How the landlord, host, and agent property-prep pilot works, what it covers, and what it does not do yet."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Host services" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">What this pilot is for</h2>
        <p className="text-sm text-slate-600">
          Use this flow when a listing or delegated portfolio property needs end-of-tenancy cleaning,
          fumigation, or minor repairs before the next tenant or guest.
        </p>
        <HelpCallout variant="info" title="This is a limited pilot">
          Move &amp; Ready Services is a vetted lead-routing pilot. It is not a booking engine or a
          public marketplace.
        </HelpCallout>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">How it works</h2>
        <HelpStepList
          steps={[
            "Start from the host overview or listings manager and open Get property-prep help.",
            "Agents can use the same narrow flow from the workspace sidebar or overview cards.",
            "Choose one of the three pilot categories and submit a short request.",
            "Ops routes the request only to vetted providers approved for the category and area.",
            "Providers respond through a secure link. You will see whether the request was matched or still needs manual follow-up.",
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">What to expect after submission</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>`Matched` means vetted providers were routed the lead.</li>
          <li>`Needs manual routing` means no approved provider fit the request yet.</li>
          <li>Requests are not auto-booked, auto-scheduled, or auto-paid.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Exact pilot scope</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>End-of-tenancy cleaning</li>
          <li>Fumigation / pest control</li>
          <li>Minor repairs / handyman</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">What this does not do yet</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>No tenant request flow</li>
          <li>No removals or move-in support</li>
          <li>No public provider browse</li>
          <li>No scheduling, payments, or ratings</li>
        </ul>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Open property-prep requests", href: "/host/services" },
          { label: "Start a prep request", href: "/host/services/new" },
          { label: "Landlord and host workflow guide", href: "/help/landlord/move-ready-services" },
          { label: "Agent guide", href: "/help/agent/services" },
          { label: "Host listings help", href: "/help/host/listings" },
        ]}
      />
    </HelpPageShell>
  );
}
