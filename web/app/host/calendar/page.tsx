import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HostCalendar } from "@/components/host/HostCalendar";
import { readActingAsFromCookies } from "@/lib/acting-as.server";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { getUserRole } from "@/lib/authz";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { resolveShortletManageState } from "@/lib/shortlet/manage-state";
import { listHostShortletBookings } from "@/lib/shortlet/shortlet.server";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSingleParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return String(Array.isArray(value) ? value[0] || "" : value || "").trim();
}

export default async function HostCalendarPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialPropertyId = readSingleParam(resolvedSearchParams, "property_id") || null;

  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/login?reason=auth&next=/host/calendar");
  }

  const role = await getUserRole(supabase, user.id);
  if (!role) redirect("/onboarding");
  if (role === "tenant") redirect("/tenant/home");
  if (role === "admin") redirect("/admin/support");

  let ownerId = user.id;
  if (role === "agent") {
    const actingAs = await readActingAsFromCookies();
    if (actingAs && actingAs !== user.id) {
      const allowed = await hasActiveDelegation(supabase, user.id, actingAs);
      if (allowed) ownerId = actingAs;
    }
  }

  const client = hasServiceRoleEnv()
    ? createServiceRoleClient()
    : supabase;

  const { data: propertyRows } = await client
    .from("properties")
    .select(
      "id,title,listing_intent,rental_type,currency,shortlet_settings(property_id,nightly_price_minor,booking_mode)"
    )
    .eq("owner_id", ownerId)
    .limit(500);

  const manageableProperties = (
    (propertyRows as
      | Array<{
          id?: string;
          title?: string | null;
          listing_intent?: string | null;
          rental_type?: string | null;
          currency?: string | null;
          shortlet_settings?: Array<{
            booking_mode?: string | null;
            nightly_price_minor?: number | null;
          }> | null;
        }>
      | null) ?? []
  ).filter((row) =>
    resolveShortletManageState({
      listing_intent: row.listing_intent,
      rental_type: row.rental_type,
      listing_currency: row.currency,
      shortlet_settings: row.shortlet_settings ?? null,
    }).isManageable
  );

  const properties = manageableProperties
    .map((row) => ({
      id: String(row.id || ""),
      title: row.title ?? null,
    }))
    .filter((row) => row.id);

  const propertyIds = properties.map((row) => row.id);

  let blocks: Array<{
    id: string;
    property_id: string;
    date_from: string;
    date_to: string;
    reason: string | null;
  }> = [];

  if (propertyIds.length) {
    const { data: rows } = await client
      .from("shortlet_blocks")
      .select("id,property_id,date_from,date_to,reason")
      .in("property_id", propertyIds)
      .order("date_from", { ascending: true })
      .limit(400);

    blocks = ((rows as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
      id: String(row.id || ""),
      property_id: String(row.property_id || ""),
      date_from: String(row.date_from || ""),
      date_to: String(row.date_to || ""),
      reason: typeof row.reason === "string" ? row.reason : null,
    }));
  }

  const bookings = await listHostShortletBookings({
    client: client as unknown as SupabaseClient,
    hostUserId: ownerId,
    limit: 400,
  });

  return (
    <div className="space-y-4" data-testid="host-calendar-page">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Host shortlets</p>
          <h1 className="text-xl font-semibold text-slate-900">Calendar</h1>
          <p className="text-sm text-slate-600">
            Visualize booked stays and manage blocked dates from one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/host/bookings">
            <Button size="sm" variant="secondary">Back to bookings</Button>
          </Link>
          <Link href="/host/shortlets/blocks">
            <Button size="sm">Blocks manager</Button>
          </Link>
        </div>
      </div>

      <HostCalendar
        properties={properties}
        initialBlocks={blocks}
        initialBookings={bookings.map((row) => ({
          id: row.id,
          property_id: row.property_id,
          check_in: row.check_in,
          check_out: row.check_out,
          status: row.status,
        }))}
        initialPropertyId={initialPropertyId}
      />
    </div>
  );
}
