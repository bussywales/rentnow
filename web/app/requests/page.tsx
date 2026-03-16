import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PropertyRequestStatusBadge } from "@/components/requests/PropertyRequestStatusBadge";
import { MARKET_OPTIONS } from "@/lib/market/market";
import {
  PROPERTY_REQUEST_BEDROOM_OPTIONS,
  PROPERTY_REQUEST_MOVE_TIMELINE_OPTIONS,
  PROPERTY_REQUEST_PROPERTY_TYPE_OPTIONS,
  PROPERTY_REQUEST_STATUSES,
  getPropertyRequestIntentLabel,
  getPropertyRequestLocationSummary,
  getPropertyRequestMoveTimelineLabel,
  type PropertyRequest,
} from "@/lib/requests/property-requests";
import {
  listDiscoverablePropertyRequests,
  requirePropertyRequestsViewerAccess,
  resolvePropertyRequestsDiscoverFilters,
} from "@/lib/requests/property-requests.server";

export const dynamic = "force-dynamic";

type RequestsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

function statusLabel(status: (typeof PROPERTY_REQUEST_STATUSES)[number]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function RequestsIndexPage({ searchParams }: RequestsPageProps) {
  const access = await requirePropertyRequestsViewerAccess("/requests", {
    allowRoles: ["tenant", "landlord", "agent", "admin"],
  });

  if (access.role === "tenant") {
    redirect("/requests/my");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const filters = resolvePropertyRequestsDiscoverFilters(resolvedSearchParams);
  const requests = await listDiscoverablePropertyRequests({
    supabase: access.supabase,
    role: access.role,
    userId: access.userId,
    filters,
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Property requests</p>
          <h1 className="text-3xl font-semibold text-slate-900">Request discovery</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Browse structured seeker demand that is visible to eligible responders. Contact details
            stay private, and only open requests remain visible to hosts and agents.
          </p>
        </div>
        {access.role === "admin" ? (
          <Link href="/admin/review">
            <Button variant="secondary">Admin review queue</Button>
          </Link>
        ) : null}
      </header>

      <form
        method="get"
        className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-5"
        data-testid="property-request-discovery-filters"
      >
        <label className="space-y-2 xl:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Search city or area
          </span>
          <Input name="q" defaultValue={filters.q ?? ""} placeholder="Lekki, Yaba, Abuja" />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Intent
          </span>
          <Select name="intent" defaultValue={filters.intent ?? ""}>
            <option value="">All intents</option>
            <option value="rent">Rent</option>
            <option value="buy">Buy</option>
            <option value="shortlet">Shortlet</option>
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Market
          </span>
          <Select name="market" defaultValue={filters.marketCode ?? ""}>
            <option value="">All markets</option>
            {MARKET_OPTIONS.map((option) => (
              <option key={option.country} value={option.country}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Property type
          </span>
          <Select name="propertyType" defaultValue={filters.propertyType ?? ""}>
            {PROPERTY_REQUEST_PROPERTY_TYPE_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Bedrooms
          </span>
          <Select name="bedrooms" defaultValue={filters.bedrooms !== null ? String(filters.bedrooms) : ""}>
            {PROPERTY_REQUEST_BEDROOM_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Move timeline
          </span>
          <Select name="moveTimeline" defaultValue={filters.moveTimeline ?? ""}>
            {PROPERTY_REQUEST_MOVE_TIMELINE_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Budget min
          </span>
          <Input
            name="budgetMin"
            inputMode="numeric"
            defaultValue={filters.budgetMin !== null ? String(filters.budgetMin) : ""}
            placeholder="100000"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Budget max
          </span>
          <Input
            name="budgetMax"
            inputMode="numeric"
            defaultValue={filters.budgetMax !== null ? String(filters.budgetMax) : ""}
            placeholder="500000"
          />
        </label>

        {access.role === "admin" ? (
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Status
            </span>
            <Select name="status" defaultValue={filters.status ?? ""}>
              <option value="">All statuses</option>
              {PROPERTY_REQUEST_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </Select>
          </label>
        ) : null}

        <div className="flex items-end gap-3 xl:col-span-1">
          <Button type="submit">Apply filters</Button>
          <Link href="/requests">
            <Button type="button" variant="secondary">
              Reset
            </Button>
          </Link>
        </div>
      </form>

      {requests.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">No matching requests</h2>
          <p className="mt-2 text-sm text-slate-600">
            Broaden the filters to see more demand. Seekers remain private until later response
            flows are added.
          </p>
        </section>
      ) : (
        <div className="grid gap-4" data-testid="property-request-discovery-board">
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
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      {request.marketCode}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {getPropertyRequestLocationSummary(request)}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">{formatBudget(request)}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                    <span>Property type: {request.propertyType ?? "Any"}</span>
                    <span>Bedrooms: {request.bedrooms ?? "Any"}</span>
                    <span>Move timeline: {getPropertyRequestMoveTimelineLabel(request.moveTimeline)}</span>
                    <span>
                      {request.expiresAt
                        ? `Expires ${new Date(request.expiresAt).toLocaleDateString()}`
                        : "No expiry set"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-3">
                  <Link href={`/requests/${request.id}`}>
                    <Button>Open request</Button>
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
