import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PropertyRequestStatusBadge } from "@/components/requests/PropertyRequestStatusBadge";
import {
  getPropertyRequestIntentLabel,
  getPropertyRequestLocationSummary,
  type PropertyRequest,
} from "@/lib/requests/property-requests";
import {
  listOwnedPropertyRequests,
  requireTenantPropertyRequestsAccess,
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

export default async function MyPropertyRequestsPage() {
  const access = await requireTenantPropertyRequestsAccess("/requests/my");
  const requests = await listOwnedPropertyRequests(access);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Property requests</p>
          <h1 className="text-3xl font-semibold text-slate-900">My requests</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Manage your demand briefs privately. Drafts stay hidden. Open requests are discoverable
            only to eligible hosts and agents.
          </p>
        </div>
        <Link href="/requests/new">
          <Button>Create property request</Button>
        </Link>
      </header>

      {requests.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">No requests yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Start with one structured request so hosts can respond with relevant listings later.
          </p>
          <div className="mt-5">
            <Link href="/requests/new">
              <Button>Create property request</Button>
            </Link>
          </div>
        </section>
      ) : (
        <div className="grid gap-4" data-testid="my-property-requests-list">
          {requests.map((request) => (
            <article
              key={request.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <PropertyRequestStatusBadge status={request.status} />
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      {getPropertyRequestIntentLabel(request.intent)}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {getPropertyRequestLocationSummary(request)}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">{formatBudget(request)}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                    <span>Move timeline: {request.moveTimeline ?? "Flexible"}</span>
                    <span>Bedrooms: {request.bedrooms ?? "Any"}</span>
                    <span>Updated: {new Date(request.updatedAt).toLocaleDateString()}</span>
                    <span>
                      {request.expiresAt
                        ? `Expires ${new Date(request.expiresAt).toLocaleDateString()}`
                        : "Not published"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-3">
                  <Link href={`/requests/${request.id}`}>
                    <Button variant="secondary">Manage</Button>
                  </Link>
                  <Link href={`/requests/${request.id}/edit`}>
                    <Button>Edit</Button>
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
