import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveServerRole } from "@/lib/auth/role";
import { listAdminListingTransferRequests } from "@/lib/properties/listing-ownership-transfer.server";
import { resolveListingTransferStatusLabel } from "@/lib/properties/listing-ownership-transfer";

export const dynamic = "force-dynamic";

function describePerson(input?: {
  full_name?: string | null;
  display_name?: string | null;
  business_name?: string | null;
} | null) {
  return input?.display_name?.trim() || input?.business_name?.trim() || input?.full_name?.trim() || "Unknown user";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export default async function AdminListingTransfersPage() {
  const { user, role } = await resolveServerRole();
  if (!user) {
    redirect("/auth/login?reason=auth&next=/admin/listing-transfers");
  }
  if (role !== "admin") {
    redirect("/forbidden?reason=role");
  }

  const rows = await listAdminListingTransferRequests();

  return (
    <div className="space-y-4" data-testid="admin-listing-transfers-page">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Listing transfers</h1>
        <p className="text-sm text-slate-600">Lightweight audit visibility for ownership transfer requests and acceptance outcomes.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Listing</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 align-top">
                      <Link href={`/host/properties/${row.property_id}/edit`} className="font-medium text-slate-900 underline-offset-2 hover:underline">
                        {row.property?.title || "Untitled listing"}
                      </Link>
                      <p className="text-xs text-slate-500">{row.property?.city || "Unknown city"}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">{describePerson(row.from_owner)}</td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      {describePerson(row.to_owner)}
                      <p className="text-xs text-slate-500">{row.recipient_email}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {resolveListingTransferStatusLabel(row.status)}
                      </span>
                      {row.last_failure_reason ? <p className="mt-1 text-xs text-rose-600">{row.last_failure_reason}</p> : null}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <p>{formatDate(row.created_at)}</p>
                      <p className="text-xs text-slate-500">Responded {formatDate(row.responded_at)}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <p>Listing status: {row.property?.status || "unknown"}</p>
                      <p className="text-xs text-slate-500">Listing ID stays canonical during transfer.</p>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No ownership transfers yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
