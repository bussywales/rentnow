import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";

export const dynamic = "force-dynamic";

export default function FeaturedHelpPage() {
  return (
    <HelpPageShell
      title="How Featured requests work"
      subtitle="Featured is request-based for now while payments are not live."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Featured" },
      ]}
    >
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">What Featured means</h2>
          <p className="mt-1 text-sm text-slate-600">
            Featured requests boost listing visibility in featured placements once approved by the admin team.
          </p>
        </section>
        <section>
          <h3 className="text-base font-semibold text-slate-900">Review flow</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>You request a slot from your host dashboard.</li>
            <li>Admin reviews listing quality and policy requirements.</li>
            <li>Approved requests are activated with the selected duration.</li>
          </ul>
        </section>
        <section>
          <h3 className="text-base font-semibold text-slate-900">Common reasons requests are blocked</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Listing is not approved or not active.</li>
            <li>Not enough photos or description detail.</li>
            <li>Listing is marked as demo.</li>
          </ul>
        </section>
        <p className="text-xs text-slate-500">
          Pricing shown in the request modal is informational only until payments go live.
        </p>
        <HelpRelatedLinks
          links={[
            { label: "Host featured guide", href: "/help/host/featured" },
            { label: "Host performance guide", href: "/help/host/performance" },
          ]}
        />
      </div>
    </HelpPageShell>
  );
}
