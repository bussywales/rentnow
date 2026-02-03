import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HelpCentrePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Help Centre</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">How can we help?</h1>
        <p className="mt-2 text-sm text-slate-600">
          Find quick answers for tenants, hosts, and internal teams.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/support"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
        >
          <h2 className="text-lg font-semibold text-slate-900">Tenant support</h2>
          <p className="mt-1 text-sm text-slate-600">Account, bookings, safety, and reporting.</p>
        </Link>
        <Link
          href="/host"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
        >
          <h2 className="text-lg font-semibold text-slate-900">Host &amp; agent help</h2>
          <p className="mt-1 text-sm text-slate-600">Listings, viewings, and trust controls.</p>
        </Link>
        <Link
          href="/help/admin"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
        >
          <h2 className="text-lg font-semibold text-slate-900">Admin &amp; ops docs</h2>
          <p className="mt-1 text-sm text-slate-600">Internal playbooks and workflows.</p>
        </Link>
      </div>
    </div>
  );
}
