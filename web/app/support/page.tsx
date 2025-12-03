import Link from "next/link";
import { appVersion, releaseDate, releaseNotes } from "@/lib/version";

export const dynamic = "force-dynamic";

export default function SupportPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Support</p>
        <h1 className="text-3xl font-semibold text-slate-900">RENTNOW status</h1>
        <p className="text-sm text-slate-600">
          Version {appVersion} • Released {releaseDate}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Release notes</h2>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
          {releaseNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Need help?</h3>
          <p className="text-sm text-slate-600">
            Having trouble with login or Supabase setup? Check your environment variables and try
            logging in on the same domain (www.rentnow.space).
          </p>
          <Link href="/api/debug/env" className="mt-3 inline-flex text-sm font-semibold text-sky-700">
            Runtime env check
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Contact</h3>
          <p className="text-sm text-slate-600">Email: hello@rentnow.africa</p>
          <p className="text-sm text-slate-600">Dashboard: manage listings, messages, viewings.</p>
        </div>
      </div>
    </div>
  );
}
