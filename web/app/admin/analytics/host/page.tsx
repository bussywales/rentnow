import Link from "next/link";
import { redirect } from "next/navigation";
import { buildHostAnalyticsIndex } from "@/lib/admin/host-analytics-index";
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
