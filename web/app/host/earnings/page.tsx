import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";
import { HostEarningsTimelineView } from "@/components/host/HostEarningsTimeline";
import { readActingAsFromCookies } from "@/lib/acting-as.server";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { getUserRole } from "@/lib/authz";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { getLatestFxSnapshot } from "@/lib/fx/fx-cache.server";
import { MARKET_COOKIE_NAME, resolveMarketFromRequest } from "@/lib/market/market";
import { getMarketSettings } from "@/lib/market/market.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { listHostShortletEarningsTimeline } from "@/lib/shortlet/shortlet.server";

export const dynamic = "force-dynamic";

export default async function HostEarningsPage() {
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/login?reason=auth&next=/host/earnings");
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

  const client = hasServiceRoleEnv() && ownerId !== user.id ? createServiceRoleClient() : supabase;
  const timeline = await listHostShortletEarningsTimeline({
    client: client as unknown as SupabaseClient,
    hostUserId: ownerId,
    limit: 220,
  });
  const requestHeaders = await headers();
  const requestCookies = await cookies();
  const marketSettings = await getMarketSettings(supabase);
  const selectedMarket = resolveMarketFromRequest({
    headers: requestHeaders,
    cookieValue: requestCookies.get(MARKET_COOKIE_NAME)?.value ?? null,
    appSettings: marketSettings,
  });
  const fxSnapshot = await getLatestFxSnapshot({
    preferredDate: new Date().toISOString().slice(0, 10),
  });

  return (
    <div className="space-y-4" data-testid="host-earnings-page">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Host shortlets</p>
          <h1 className="text-xl font-semibold text-slate-900">Earnings & payouts</h1>
          <p className="text-sm text-slate-600">
            See what is pending, available, and paid. Manual payout processing remains enabled during pilot.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/host/bookings">
            <Button size="sm" variant="secondary">Bookings</Button>
          </Link>
          <Link href="/host/calendar">
            <Button size="sm" variant="secondary">Calendar</Button>
          </Link>
          <Link href="/host">
            <Button size="sm">Back to listings</Button>
          </Link>
        </div>
      </div>

      <HostEarningsTimelineView
        timeline={timeline}
        marketCurrency={selectedMarket.currency}
        fxSnapshot={fxSnapshot}
      />
    </div>
  );
}
