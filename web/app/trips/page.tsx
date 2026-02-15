import { redirect } from "next/navigation";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { listGuestShortletBookings } from "@/lib/shortlet/shortlet.server";
import { TenantTripsPanel } from "@/components/tenant/TenantTripsPanel";

export const dynamic = "force-dynamic";

export default async function TripsPage() {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Trips are unavailable right now.
        </div>
      </div>
    );
  }

  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/required?redirect=/trips&reason=auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "tenant") {
    redirect("/forbidden?reason=role");
  }

  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const bookings = await listGuestShortletBookings({
    client,
    guestUserId: user.id,
    limit: 100,
  }).catch(() => []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4">
      <TenantTripsPanel initialRows={bookings} />
    </div>
  );
}
