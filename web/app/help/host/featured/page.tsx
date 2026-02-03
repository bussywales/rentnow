import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";

export const dynamic = "force-dynamic";

export default function HostFeaturedHelpPage() {
  return (
    <HelpPageShell
      title="Featured listings"
      subtitle="What featured exposure means for hosts."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Featured listings" },
      ]}
    >
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6">
        <h2 className="text-lg font-semibold text-slate-900">Guide coming soon</h2>
        <p className="mt-2 text-sm text-slate-600">
          We&apos;re preparing a detailed guide for featured listings. For now, see the performance guide for what featured
          means and how it affects exposure.
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
