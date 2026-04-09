import Link from "next/link";
import { headers } from "next/headers";
import { ErrorState } from "@/components/ui/ErrorState";
import { MoveReadyRequestForm } from "@/components/services/MoveReadyRequestForm";
import { ProductEventTracker } from "@/components/analytics/ProductEventTracker";
import { getProfile } from "@/lib/auth";
import { readActingAsFromCookies } from "@/lib/acting-as.server";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { MARKET_COOKIE_NAME, readCookieValueFromHeader, resolveMarketFromRequest } from "@/lib/market/market";
import { getMarketSettings } from "@/lib/market/market.server";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

type HostPropertyOptionRow = {
  id: string;
  title: string | null;
  city: string | null;
  location_label: string | null;
  country_code: string | null;
};

export default async function HostMoveReadyNewPage({ searchParams }: Props) {
  if (!hasServerSupabaseEnv() || !hasServiceRoleEnv()) {
    return (
      <ErrorState
        title="Move & Ready Services unavailable"
        description="Services routing needs the secured database environment before requests can be accepted."
        retryHref="/host"
        retryLabel="Back to workspace"
      />
    );
  }

  const profile = await getProfile();
  if (!profile?.id) {
    return (
      <ErrorState
        title="Sign in required"
        description="Sign in again to request property-prep help."
        retryHref="/auth/login"
        retryLabel="Open login"
      />
    );
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const requestedPropertyId =
    typeof resolvedParams.propertyId === "string" ? resolvedParams.propertyId : null;
  const requestedEntrypoint =
    typeof resolvedParams.entrypoint === "string" && resolvedParams.entrypoint === "host_listings"
      ? "host_listings"
      : "host_overview";

  const headerList = await headers();
  const market = resolveMarketFromRequest({
    headers: headerList,
    cookieValue: readCookieValueFromHeader(headerList.get("cookie"), MARKET_COOKIE_NAME),
    appSettings: await getMarketSettings(),
  });

  const client = createServiceRoleClient();
  let propertyOwnerId = profile.id;
  if (profile.role === "agent") {
    const actingAs = await readActingAsFromCookies();
    if (actingAs && actingAs !== profile.id) {
      const allowed = await hasActiveDelegation(client, profile.id, actingAs);
      if (allowed) {
        propertyOwnerId = actingAs;
      }
    }
  }
  const { data } = await client
    .from("properties")
    .select("id,title,city,location_label,country_code")
    .eq("owner_id", propertyOwnerId)
    .order("updated_at", { ascending: false });

  const helpHref = profile.role === "agent" ? "/help/agent/services" : "/help/host/services";

  const properties = ((data ?? []) as HostPropertyOptionRow[]).map((row) => ({
    id: row.id,
    title: row.title?.trim() || "Untitled property",
    city: row.city ?? null,
    area: row.location_label ?? null,
    marketCode: row.country_code ?? null,
  }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <ProductEventTracker
        eventName="service_request_started"
        dedupeKey={`move-ready-started:${requestedEntrypoint}:${requestedPropertyId ?? "none"}`}
        properties={{
          role: profile.role ?? "landlord",
          requesterRole: profile.role ?? "landlord",
          entrypointSource: requestedEntrypoint,
          propertyId: requestedPropertyId ?? undefined,
          market: market.country,
          pagePath: "/host/services/new",
        }}
      />
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Move &amp; Ready Services
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
                Pilot active
              </span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
                Limited capacity
              </span>
            </div>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Get property-prep help</h1>
            <p className="mt-2 text-sm text-slate-600">
              Request vetted help for cleaning, fumigation, or minor repairs tied to the next tenant,
              guest, or relist. This is a lead-routing flow only for landlord, host, and agent
              workflows.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              If no vetted provider fits the request, it stays in manual operator follow-up instead of
              pretending coverage exists.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Link href="/host/services" className="text-sm font-semibold text-sky-700">
              View prep requests
            </Link>
            <Link href={helpHref} className="text-sm font-semibold text-slate-700">
              Pilot guide
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <MoveReadyRequestForm
          properties={properties}
          defaultMarketCode={market.country}
          defaultPropertyId={requestedPropertyId}
          entrypointSource={requestedEntrypoint}
        />
      </section>
    </div>
  );
}
