import { redirect } from "next/navigation";
import { resolveServerRole } from "@/lib/auth/role";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { readActingAsFromCookies } from "@/lib/acting-as.server";
import { fetchOwnerListings } from "@/lib/properties/owner-listings";
import { computeDashboardListings } from "@/lib/properties/host-dashboard";
import { HostPropertiesManager } from "@/components/host/HostPropertiesManager";

export const dynamic = "force-dynamic";

export default async function HostPropertiesManagerPage() {
  if (!hasServerSupabaseEnv()) return null;

  const { supabase, user, role } = await resolveServerRole();

  if (!user) {
    redirect("/auth/login?reason=auth");
  }

  if (role === "tenant") {
    redirect("/tenant/home");
  }

  if (role !== "landlord" && role !== "agent" && role !== "admin") {
    redirect("/onboarding");
  }

  let ownerId = user.id;
  if (role === "agent") {
    const actingAs = await readActingAsFromCookies();
    if (actingAs && actingAs !== user.id) {
      const allowed = await hasActiveDelegation(supabase, user.id, actingAs);
      if (allowed) {
        ownerId = actingAs;
      }
    }
  }

  const { data, error } = await fetchOwnerListings({
    supabase,
    ownerId,
    isAdmin: role === "admin",
  });

  const listings = computeDashboardListings(data);

  return (
    <div className="space-y-4" data-testid="host-properties-page">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Listings manager</h1>
        <p className="text-sm text-slate-600">
          Review listing health, find drafts quickly, and jump straight into editing.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {error}
        </div>
      ) : (
        <HostPropertiesManager listings={listings} />
      )}
    </div>
  );
}
