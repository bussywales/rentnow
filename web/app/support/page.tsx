import Link from "next/link";
import { appVersion, releaseDate, releaseNotes } from "@/lib/version";
import SupportContactForm from "@/components/support/SupportContactForm";

export const dynamic = "force-dynamic";

export default function SupportPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Support</p>
        <h1 className="text-3xl font-semibold text-slate-900">Contact support</h1>
        <p className="text-sm text-slate-600">
          Use this form to contact support or report an issue. Version {appVersion} • Released {releaseDate}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">How we can help</h3>
          <p className="text-sm text-slate-600">
            Let us know what you need and our team will follow up. Choose a category to route your request faster.
          </p>
          <div className="mt-4">
            <SupportContactForm />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Status</h3>
          <p className="text-sm text-slate-600">Track recent releases and system updates.</p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-sm font-semibold text-slate-900">Release notes</h4>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
              {releaseNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
          <Link href="/api/debug/env" className="mt-3 inline-flex text-sm font-semibold text-sky-700">
            Runtime env check
          </Link>
        </div>
      </div>
    </div>
  );
}
