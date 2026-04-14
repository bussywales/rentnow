import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";

export const dynamic = "force-dynamic";

export default function HostListingsHelpPage() {
  return (
    <HelpPageShell
      title="Host listings help"
      subtitle="Guidance for improving listing quality, visibility, and offline sharing."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Host listings" },
      ]}
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Open QR sign kits for live listings</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p>
              Open a live listing you manage and use <span className="font-semibold text-slate-900">Open sign kit</span>
              {" "}inside the listing share panel.
            </p>
            <p>
              PropatyHub creates a tracked share link for that listing, builds a QR code from it, and lets you download a simple sign sheet or QR card.
            </p>
            <p>
              Only live listings can generate sign kits. If a listing is withdrawn or becomes inactive later, the QR no longer exposes stale listing content.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6">
          <h2 className="text-lg font-semibold text-slate-900">What the sign kit is for</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Use it for property windows, printed sheets, and on-site signs tied to one live listing.</li>
            <li>Copy the tracked link when you want a digital fallback alongside the QR.</li>
            <li>Do not treat it as a generic QR generator or a way to keep inactive listings publicly reachable.</li>
          </ul>
        </section>

        <HelpRelatedLinks
          links={[
            { label: "Plans and pay-per-listing", href: "/help/landlord/listing-monetisation" },
            { label: "Detailed QR sign kit guide", href: "/help/landlord/qr-sign-kit" },
            { label: "Performance and insights", href: "/help/host/performance" },
            { label: "Move & Ready Services pilot", href: "/help/host/services" },
            { label: "Contact support", href: "/support" },
          ]}
        />
      </div>
    </HelpPageShell>
  );
}
