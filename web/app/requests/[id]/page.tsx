import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PropertyRequestManageActions } from "@/components/requests/PropertyRequestManageActions";
import { PropertyRequestStatusBadge } from "@/components/requests/PropertyRequestStatusBadge";
import {
  getPropertyRequestIntentLabel,
  getPropertyRequestLocationSummary,
  getPropertyRequestMoveTimelineLabel,
  type PropertyRequest,
} from "@/lib/requests/property-requests";
import {
  loadVisiblePropertyRequest,
  requirePropertyRequestsViewerAccess,
} from "@/lib/requests/property-requests.server";

export const dynamic = "force-dynamic";

function formatMoney(value: number | null, currencyCode: string) {
  if (typeof value !== "number") return "Any";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toLocaleString()}`;
  }
}

function formatBudget(request: PropertyRequest) {
  if (typeof request.budgetMin === "number" && typeof request.budgetMax === "number") {
    return `${formatMoney(request.budgetMin, request.currencyCode)} - ${formatMoney(request.budgetMax, request.currencyCode)}`;
  }
  if (typeof request.budgetMin === "number") {
    return `From ${formatMoney(request.budgetMin, request.currencyCode)}`;
  }
  if (typeof request.budgetMax === "number") {
    return `Up to ${formatMoney(request.budgetMax, request.currencyCode)}`;
  }
  return "Budget flexible";
}

function RequestFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

export default async function PropertyRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await requirePropertyRequestsViewerAccess(`/requests/${id}`, {
    allowRoles: ["tenant", "landlord", "agent", "admin"],
  });
  const request = await loadVisiblePropertyRequest({
    supabase: access.supabase,
    role: access.role,
    userId: access.userId,
    requestId: id,
  });

  if (!request) {
    notFound();
  }

  const viewerCanManage = access.role === "tenant" && request.ownerUserId === access.userId;
  const backHref = viewerCanManage ? "/requests/my" : "/requests";
  const backLabel = viewerCanManage ? "Back to my requests" : "Back to request board";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <PropertyRequestStatusBadge status={request.status} />
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              {getPropertyRequestIntentLabel(request.intent)}
            </p>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{request.marketCode}</p>
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              {getPropertyRequestLocationSummary(request)}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {viewerCanManage
                ? "Manage your request privately. Only you, admins, and eligible responders for open requests can access this demand brief."
                : "Review the structured demand brief. Seeker contact information remains private until a later response workflow is shipped."}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href={backHref}>
            <Button variant="secondary">{backLabel}</Button>
          </Link>
          {viewerCanManage ? (
            <Link href={`/requests/${request.id}/edit`}>
              <Button>Edit request</Button>
            </Link>
          ) : null}
        </div>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <RequestFact label="Budget" value={formatBudget(request)} />
          <RequestFact label="Property type" value={request.propertyType ?? "Any"} />
          <RequestFact label="Bedrooms" value={request.bedrooms?.toString() ?? "Any"} />
          <RequestFact label="Bathrooms" value={request.bathrooms?.toString() ?? "Any"} />
          <RequestFact
            label="Move timeline"
            value={getPropertyRequestMoveTimelineLabel(request.moveTimeline)}
          />
          <RequestFact
            label="Furnished"
            value={
              request.furnished === null
                ? "No preference"
                : request.furnished
                  ? "Furnished"
                  : "Unfurnished"
            }
          />
          <RequestFact
            label="Published"
            value={request.publishedAt ? new Date(request.publishedAt).toLocaleString() : "Not published"}
          />
          <RequestFact
            label="Expires"
            value={request.expiresAt ? new Date(request.expiresAt).toLocaleDateString() : "Not scheduled"}
          />
        </div>

        {request.shortletDuration ? (
          <div className="mt-4">
            <RequestFact label="Shortlet duration" value={request.shortletDuration} />
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
            {request.notes ?? "No extra requirements added yet."}
          </p>
        </div>
      </section>

      {viewerCanManage ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Manage request</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Request lifecycle</h2>
          <p className="mt-2 text-sm text-slate-600">
            Publish when the request is ready, pause it back to draft if you want it hidden, or close
            it when you no longer need responses.
          </p>
          <div className="mt-4">
            <PropertyRequestManageActions requestId={request.id} status={request.status} />
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Phase 3 scope</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">Responder workflow is deferred</h2>
          <p className="mt-2 text-sm text-slate-600">
            This phase exposes structured demand so hosts, agents, and admins can inspect active
            requests safely. Sending matching listings will be added in a later phase.
          </p>
        </section>
      )}
    </div>
  );
}
