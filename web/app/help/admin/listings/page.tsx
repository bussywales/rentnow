export const dynamic = "force-dynamic";

export default function AdminListingsHelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin &amp; Ops</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Listings review &amp; featured</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use this guide to keep review decisions consistent and featured inventory healthy.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Lifecycle checkpoints</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>Review pending listings daily for completeness, safety, and media quality.</li>
          <li>Paused listings are not public but remain visible for owners and admins.</li>
          <li>Expired listings should be renewed before reactivation.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Featured operations</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>Use rank for priority; lower numbers surface first.</li>
          <li>Set “Featured until” to avoid stale inventory.</li>
          <li>Monitor impressions, clicks, and leads in the Featured panel.</li>
        </ul>
      </section>
    </div>
  );
}
