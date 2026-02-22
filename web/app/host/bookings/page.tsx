import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HostShortletBookingsPanel } from "@/components/host/HostShortletBookingsPanel";
import { Button } from "@/components/ui/Button";
import { readActingAsFromCookies } from "@/lib/acting-as.server";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { getUserRole } from "@/lib/authz";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  listHostShortletBookings,
  listHostShortletSettings,
  type HostShortletBookingSummary,
  type HostShortletSettingSummary,
} from "@/lib/shortlet/shortlet.server";

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

export default async function HostBookingsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const focusBookingId = readSingleParam(resolvedSearchParams, "booking");

  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/login?reason=auth&next=/host/bookings");
  }

  const role = await getUserRole(supabase, user.id);
  if (!role) {
    redirect("/onboarding");
  }
  if (role === "tenant") {
    redirect("/tenant/home");
  }
  if (role === "admin") {
    redirect("/admin/support");
  }

  let ownerId = user.id;
  if (role === "agent") {
    const actingAs = await readActingAsFromCookies();
    if (actingAs && actingAs !== user.id) {
      const allowed = await hasActiveDelegation(supabase, user.id, actingAs);
      if (allowed) ownerId = actingAs;
    }
  }

  let rows: HostShortletBookingSummary[] = [];
  let settingsRows: HostShortletSettingSummary[] = [];
  let loadError: string | null = null;

  try {
    const shortletClient = hasServiceRoleEnv()
      ? createServiceRoleClient()
      : supabase;

    [rows, settingsRows] = await Promise.all([
      listHostShortletBookings({
        client: shortletClient as unknown as SupabaseClient,
        hostUserId: ownerId,
        limit: 120,
      }),
      listHostShortletSettings({
        client: shortletClient as unknown as SupabaseClient,
        hostUserId: ownerId,
        limit: 120,
      }),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load host bookings.";
  }

  return (
    <div className="min-w-0 space-y-4" data-testid="host-bookings-page">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Host shortlets</p>
          <h2 className="text-xl font-semibold text-slate-900">Bookings inbox</h2>
          <p className="text-sm text-slate-600">
            Review requests, respond within 12 hours, and manage upcoming stays.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link href="/host/calendar">
            <Button variant="secondary" size="sm">Calendar</Button>
          </Link>
          <Link href="/host/shortlets/blocks">
            <Button variant="secondary" size="sm">Manage availability</Button>
          </Link>
          <Link href="/host">
            <Button size="sm">Back to listings</Button>
          </Link>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadError}
        </div>
      ) : null}

      <div id="host-bookings" className="scroll-mt-28">
        <HostShortletBookingsPanel
          initialRows={rows}
          settingsRows={settingsRows}
          focusBookingId={focusBookingId || null}
        />
      </div>
    </div>
  );
}
