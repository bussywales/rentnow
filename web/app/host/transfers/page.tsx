import { redirect } from "next/navigation";
import { ListingTransfersInbox } from "@/components/host/ListingTransfersInbox";
import { resolveServerRole } from "@/lib/auth/role";
import {
  listListingTransferRequestsForUser,
  summarizeListingTransferRequests,
} from "@/lib/properties/listing-ownership-transfer.server";

export const dynamic = "force-dynamic";

export default async function HostListingTransfersPage() {
  const { user, role } = await resolveServerRole();
  if (!user) {
    redirect("/auth/login?reason=auth&next=/host/transfers");
  }
  if (role === "tenant") {
    redirect("/tenant/home");
  }
  if (role !== "landlord" && role !== "agent") {
    redirect("/onboarding");
  }

  const { incoming, outgoing } = await listListingTransferRequestsForUser(user.id);
  const summary = summarizeListingTransferRequests({ incoming, outgoing });

  return (
    <div className="space-y-4" data-testid="host-listing-transfers-page">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ownership workflow</p>
        <h1 className="text-2xl font-semibold text-slate-900">Listing transfers</h1>
        <p className="mt-1 text-sm text-slate-600">
          Accept, reject, or cancel controlled listing ownership transfers. A listing stays with its current owner until the recipient accepts.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Pending incoming</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.pendingIncoming}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Pending outgoing</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.pendingOutgoing}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Accepted transfers</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.acceptedCount}</p>
          </div>
        </div>
      </div>

      <ListingTransfersInbox incoming={incoming} outgoing={outgoing} />
    </div>
  );
}
