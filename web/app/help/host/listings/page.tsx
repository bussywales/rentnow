import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";

export const dynamic = "force-dynamic";

export default function HostListingsHelpPage() {
  return (
    <HelpPageShell
      title="Host listings help"
      subtitle="Guidance for improving listing quality and visibility."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Host listings" },
      ]}
    >
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6">
        <h2 className="text-lg font-semibold text-slate-900">More guides coming soon</h2>
        <p className="mt-2 text-sm text-slate-600">
          We&apos;re preparing detailed listing tips. In the meantime, use the performance guide and support resources.
        </p>
        <div className="mt-4">
          <HelpRelatedLinks
            links={[
              { label: "Performance and insights", href: "/help/host/performance" },
              { label: "Contact support", href: "/support" },
            ]}
          />
        </div>
      </div>
    </HelpPageShell>
  );
}
