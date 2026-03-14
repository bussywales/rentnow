import Link from "next/link";
import { redirect } from "next/navigation";
import { buildHostAnalyticsIndex } from "@/lib/admin/host-analytics-index";
import { fetchHostListingQualityTelemetrySnapshot } from "@/lib/properties/listing-quality-telemetry-report";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type HostAnalyticsIndexProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const formatActivityDate = (value: string | null) => {
  if (!value) return "—";
  return new Date(value).toISOString().slice(0, 10);
};

export default async function AdminHostAnalyticsIndexPage({
  searchParams,
}: HostAnalyticsIndexProps) {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Host analytics</h1>
        <p className="text-sm text-slate-600">Supabase is not configured; analytics are unavailable.</p>
      </div>
    );
  }

  const { supabase, user } = await getServerAuthUser();

  if (!user) {
    redirect("/auth/required?redirect=/admin/analytics/host&reason=auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  if (!hasServiceRoleEnv()) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Host analytics</h1>
        <p className="text-sm text-slate-600">
          Service role key missing; analytics are unavailable.
        </p>
      </div>
    );
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const query =
    typeof resolvedParams.q === "string" ? resolvedParams.q.trim().toLowerCase() : "";

  const adminClient = createServiceRoleClient();
  const snapshot = await buildHostAnalyticsIndex(adminClient);
  const qualityTelemetry = await fetchHostListingQualityTelemetrySnapshot({
    client: adminClient,
  });
  const hosts = query
    ? snapshot.hosts.filter((host) => {
        const label = host.label.toLowerCase();
        return (
          label.includes(query) ||
          host.id.toLowerCase().includes(query) ||
          host.shortId.toLowerCase().includes(query)
        );
      })
    : snapshot.hosts;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin</p>
        <h1 className="text-3xl font-semibold text-slate-900">Host analytics</h1>
        <p className="text-sm text-slate-600">
          Search by host id or name. Click a host to view details.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          placeholder="Search hosts… (name or id)"
          defaultValue={query}
          className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
        {query && (
          <Link href="/admin/analytics/host" className="text-sm font-semibold text-slate-600">
            Clear
          </Link>
        )}
      </form>

      {snapshot.error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {snapshot.error}
        </div>
      )}

      <section
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        data-testid="admin-host-quality-telemetry"
      >
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Host quality guidance telemetry</h2>
          <p className="text-sm text-slate-600">
            Submit-step listing quality telemetry for guidance views, fix clicks, and score changes before submit.
          </p>
          <p className="text-xs text-slate-500">{qualityTelemetry.range.label}</p>
        </div>

        {qualityTelemetry.error && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {qualityTelemetry.error}
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Guidance viewed</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {qualityTelemetry.guidanceViewed}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Fix clicks</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {qualityTelemetry.fixClicked}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              CTR{" "}
              {qualityTelemetry.clickThroughRate === null
                ? "—"
                : `${qualityTelemetry.clickThroughRate.toFixed(2)}%`}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Submit attempts</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {qualityTelemetry.submitAttempted}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Improvement rate</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {qualityTelemetry.improvementRate === null
                ? "—"
                : `${qualityTelemetry.improvementRate.toFixed(2)}%`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Avg score delta{" "}
              {qualityTelemetry.averageScoreDelta === null
                ? "—"
                : `${qualityTelemetry.averageScoreDelta > 0 ? "+" : ""}${qualityTelemetry.averageScoreDelta.toFixed(2)}`}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-xl border border-slate-200">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Fix clicks by target step</h3>
            </div>
            <table className="min-w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Target step</th>
                  <th className="px-4 py-3">Clicks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {qualityTelemetry.byTargetStep.map((row) => (
                  <tr key={row.key}>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.label}</td>
                    <td className="px-4 py-3">{row.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
            <h3 className="font-semibold text-slate-900">What this answers</h3>
            <ul className="mt-3 space-y-2">
              <li>Are hosts reaching the submit-step guidance?</li>
              <li>Are they using the jump-back fix actions?</li>
              <li>Which step needs the most fixes right now?</li>
              <li>Are listing scores improving before submit?</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
          Range: {snapshot.range.label} · Showing {hosts.length} host
          {hosts.length === 1 ? "" : "s"}
        </div>
        {hosts.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-600">
            No hosts found. Try a different search or paste the host id.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Host</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Listings</th>
                  <th className="px-4 py-3">Threads</th>
                  <th className="px-4 py-3">Views</th>
                  <th className="px-4 py-3">Last activity</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hosts.map((host) => (
                  <tr key={host.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{host.label}</div>
                      <div className="text-xs text-slate-500">{host.shortId}</div>
                    </td>
                    <td className="px-4 py-3 capitalize">{host.role}</td>
                    <td className="px-4 py-3">
                      {host.listings === null ? "Not available" : host.listings}
                    </td>
                    <td className="px-4 py-3">
                      {host.enquiriesAvailable ? host.enquiries : "Not available"}
                    </td>
                    <td className="px-4 py-3">{host.viewsAvailable ? host.views : "Not available"}</td>
                    <td className="px-4 py-3">{formatActivityDate(host.lastActivity)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/analytics/host/${host.id}`}
                        className="text-sm font-semibold text-slate-700 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
