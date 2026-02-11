import Link from "next/link";

export const dynamic = "force-dynamic";

export default function TrustHelpPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Trust guide</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          What does Verified mean?
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Trust badges help you quickly understand listing freshness and advertiser verification status.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Verified advertiser</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Shown when the advertiser passes the platform identity checks we currently enforce.</li>
          <li>Verification checks can change over time as documents or account status change.</li>
          <li>Always verify listing details directly before payment decisions.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Identity pending</h2>
        <p className="mt-2 text-sm text-slate-700">
          This appears when identity verification is incomplete. You can still review the listing, but use extra caution and ask for confirmation details during enquiries.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Popularity and activity badges</h2>
        <p className="mt-2 text-sm text-slate-700">
          Badges like <strong>Popular this week</strong>, <strong>Saved 10+</strong>, and <strong>Viewed 100+</strong> are privacy-safe indicators. They are bucketed ranges, not exact counts.
        </p>
      </section>

      <footer className="flex flex-wrap gap-3">
        <Link href="/help" className="text-sm font-semibold text-sky-700">
          Back to Help Centre
        </Link>
        <Link href="/properties" className="text-sm font-semibold text-sky-700">
          Browse listings
        </Link>
      </footer>
    </div>
  );
}
