import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminHelpPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin &amp; Ops</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Getting started</h1>
        <p className="mt-2 text-sm text-slate-600">
          Quick, reliable guidance for PropatyHub operations. Keep actions consistent and audit-friendly.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">How listings lifecycle works</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>Draft → Submitted/Pending → Under review → Live.</li>
          <li>Paused listings (Owner hold / Occupied) stay visible to hosts and admins only.</li>
          <li>Expired listings should be renewed before reactivation.</li>
        </ul>
        <Link
          href="/help/admin/listings"
          className="inline-flex items-center text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          Read the listings playbook →
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">How featured listings work</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>Featured inventory shows only LIVE listings with active scheduling.</li>
          <li>Rank controls priority; “Featured until” controls expiration.</li>
          <li>Performance metrics are visible in the Admin Featured panel.</li>
        </ul>
        <Link
          href="/help/admin/listings"
          className="inline-flex items-center text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          Featured workflow details →
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Product updates checklist</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>Keep summaries short: what changed + where to find it.</li>
          <li>Use screenshots only when they clarify the change.</li>
          <li>Publish for the right audience (tenant, host, admin, or all).</li>
        </ul>
        <Link
          href="/admin/product-updates"
          className="inline-flex items-center text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          Manage product updates →
        </Link>
      </section>
    </div>
  );
}
