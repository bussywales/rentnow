import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpCopyBlock } from "@/components/help/HelpCopyBlock";
import { HelpIssueCard } from "@/components/help/HelpIssueCard";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";

export const dynamic = "force-dynamic";

export default function MoveReadyServicesPlaybookPage() {
  return (
    <HelpPageShell
      title="Move & Ready pilot launch pack"
      subtitle="Internal launch pack for running the curated property-prep pilot daily without widening scope on the fly."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        { label: "Move & Ready pilot launch pack" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Pilot launch overview</h2>
        <p className="text-sm text-slate-600">
          Move &amp; Ready is a narrow property-prep request-routing pilot for landlords, hosts, and
          agents. It exists to prove that vetted provider routing can solve real turnover and
          relist-readiness needs without turning PropatyHub into a broad services marketplace.
        </p>
        <HelpCallout variant="info" title="In scope for this pilot">
          Requesters stay limited to landlords, hosts, and agents. Categories stay limited to
          end-of-tenancy cleaning, fumigation / pest control, and minor repairs / handyman.
        </HelpCallout>
        <HelpCallout variant="warn" title="Keep the wedge narrow">
          Do not use this pilot to justify tenant expansion, removals, move-in services, booking,
          scheduling, payments, reviews, or public provider discovery.
        </HelpCallout>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">What success looks like</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Real request demand arrives from the existing landlord, host, and agent cohort.</li>
          <li>Ops can route requests to vetted providers without backlog or guesswork.</li>
          <li>Providers respond fast enough that requesters feel the service is real and useful.</li>
          <li>The team can judge the pilot on match quality and operator burden, not on marketplace breadth.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Operator daily run sheet</h2>
        <HelpStepList
          steps={[
            "Start in /admin/services/requests and review new requests from the last 24 hours first.",
            "Validate each request: requester is landlord, host, or agent; category is one of the three pilot categories; area is inside the active pilot geography; and the note is specific enough to route.",
            "Route only to vetted providers approved for the category and geography. Use /admin/services/providers if coverage needs checking before dispatch.",
            "Treat unmatched requests as active work. Assign a named owner, decide whether to manually dispatch, keep as unmatched pending manual follow-up, or close the loop manually if no safe provider exists.",
            "Treat stale requests as anything unmatched for more than one business day or any request without a named follow-up owner by end of day. Escalate if unmatched requests exceed two business days.",
            "Record the day: request count, matched vs unmatched, delivery failures, notable provider response quality, and any scope-creep attempts.",
          ]}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Escalate immediately when</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>unmatched backlog older than two business days exceeds 5 open requests</li>
          <li>lead delivery failures exceed 15 percent of sent leads in a week</li>
          <li>provider response rate drops below 35 percent in a week</li>
          <li>providers are being approved faster than ops can quality-check them</li>
          <li>requesters keep trying to use the flow outside the three approved pilot categories</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Provider outreach / onboarding script</h2>
        <HelpCopyBlock title="Internal template">
{`Hi [Provider name],

We are inviting a small number of vetted providers into the PropatyHub Move & Ready pilot.

This pilot is not a public marketplace. It is a curated property-prep routing flow for landlord, host, and agent requests in a narrow scope: end-of-tenancy cleaning, fumigation / pest control, and minor repairs / handyman.

If you are approved, you will receive lead requests only for the categories and areas we have agreed with you. You will respond through a secure provider link with a clear accept / decline and one usable response note or quote note within 24 hours.

This pilot is manually curated. We will pause providers quickly if response quality slips, if leads are repeatedly ignored, or if the service area no longer matches the active pilot geography.

If you want to continue, we will confirm your approved categories, geography, and primary contact details before sending any leads.`}
        </HelpCopyBlock>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Stakeholder / tester brief</h2>
        <HelpCopyBlock title="Tester brief">
{`Who should test:
- internal operators
- landlord, host, or agent testers already inside the active pilot geography
- one or two vetted providers who understand this is a manual pilot

What to test:
- can a valid request be submitted cleanly
- does the request land in admin services requests
- does routing happen only to vetted providers in scope
- can the provider respond through the secure link
- is unmatched handling visible and understandable

What screenshots / feedback to send back:
- request form state
- request detail state
- admin request queue state
- provider response state
- any point where the pilot scope is confusing

What not to judge this pilot as:
- not a public marketplace
- not a scheduling product
- not a payment flow
- not a broad home-services expansion

What good looks like for this phase:
- valid requests enter the system
- providers reply fast enough to keep trust
- ops can keep the queue clean without heroics`}
        </HelpCopyBlock>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Feedback and weekly review template</h2>
        <HelpCopyBlock title="Weekly review template">
{`Pilot period:
Active market:
Active city / area clusters:

Request volume:
Matched requests:
Unmatched requests:
Provider response quality:
Operator burden:
User confusion points:
Delivery failures:
Requests outside pilot scope:

Decision:
- continue
- tighten scope
- pause

If continuing, state one narrow follow-up only.
If tightening, state which category, geography, or provider cohort should be reduced.
If pausing, state the exact operational reason and owner.`}
        </HelpCopyBlock>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Success and stop rules</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <HelpIssueCard
            issue="Continue"
            cause="The wedge is matching, providers are responding, and ops can keep control of the queue."
            check="At least 15 requests, 70%+ match rate, 60%+ provider response rate, and controlled operator burden."
            fix="Keep scope fixed and prepare one narrow hardening batch only."
          />
          <HelpIssueCard
            issue="Tighten"
            cause="Demand exists but one part of the pilot is creating drag."
            check="50-69% match rate, 35-59% provider response rate, or growing unmatched backlog."
            fix="Tighten geography, provider cohort, or weak copy before any expansion discussion."
          />
          <HelpIssueCard
            issue="Pause"
            cause="The pilot is creating more confusion or manual burden than value."
            check="Match rate below 50%, response rate below 35%, or unmatched backlog older than two business days above 5."
            fix="Pause expansion talk and rework ops discipline first."
          />
        </div>
      </section>

      <HelpRelatedLinks
        links={[
          {
            label: "Admin services hub",
            href: "/admin/services",
            description: "Use this for daily pilot operations and provider/request routing.",
          },
          {
            label: "Requests queue",
            href: "/admin/services/requests",
            description: "Check new requests, unmatched backlog, and stale follow-up first.",
          },
          {
            label: "Providers",
            href: "/admin/services/providers",
            description: "Confirm vetted provider coverage before routing or approving anyone new.",
          },
          {
            label: "Host pilot guide",
            href: "/help/host/services",
            description: "Use this when briefing landlords, hosts, and agents on the current wedge scope.",
          },
        ]}
      />
    </HelpPageShell>
  );
}
