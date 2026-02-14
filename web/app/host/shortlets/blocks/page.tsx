import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { readActingAsFromCookies } from "@/lib/acting-as.server";

export const dynamic = "force-dynamic";

type BlockRow = {
  id: string;
  property_id: string;
  date_from: string;
  date_to: string;
  reason: string | null;
  property_title: string | null;
};

export default async function HostShortletBlocksPage() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) redirect("/auth/required?redirect=/host/shortlets/blocks&reason=auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? null;
  if (role !== "landlord" && role !== "agent") redirect("/forbidden?reason=role");

  let ownerId = user.id;
  if (role === "agent") {
    const actingAs = await readActingAsFromCookies();
    if (actingAs && actingAs !== user.id) {
      const allowed = await hasActiveDelegation(supabase, user.id, actingAs);
      if (allowed) ownerId = actingAs;
    }
  }

  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;

  const { data: propertyRows } = await client
    .from("properties")
    .select("id,title")
    .eq("owner_id", ownerId)
    .limit(500);
  const propertyMap = new Map<string, string | null>(
    ((propertyRows as Array<{ id: string; title?: string | null }> | null) ?? []).map((row) => [
      row.id,
      row.title ?? null,
    ])
  );
  const propertyIds = Array.from(propertyMap.keys());

  let blocksRows: Array<Record<string, unknown>> = [];
  if (propertyIds.length) {
    const { data: blocksData } = await client
      .from("shortlet_blocks")
      .select("id,property_id,date_from,date_to,reason")
      .in("property_id", propertyIds)
      .order("date_from", { ascending: true })
      .limit(200);
    blocksRows = (blocksData as Array<Record<string, unknown>> | null) ?? [];
  }

  const rows: BlockRow[] = blocksRows.map((row) => {
    return {
      id: String(row.id || ""),
      property_id: String(row.property_id || ""),
      date_from: String(row.date_from || ""),
      date_to: String(row.date_to || ""),
      reason: typeof row.reason === "string" ? row.reason : null,
      property_title: propertyMap.get(String(row.property_id || "")) ?? null,
    };
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Host shortlets</p>
        <h1 className="text-2xl font-semibold text-slate-900">Calendar blocks</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review manual blocked dates for your shortlet listings.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/host" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Back to host dashboard
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/properties/${row.property_id}`} className="font-semibold text-sky-700 underline underline-offset-2">
                      {row.property_title || row.property_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.date_from}</td>
                  <td className="px-4 py-3">{row.date_to}</td>
                  <td className="px-4 py-3">{row.reason || "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-slate-500">
                  No calendar blocks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
