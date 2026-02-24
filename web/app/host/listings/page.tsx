import { redirect } from "next/navigation";
import { resolveServerRole } from "@/lib/auth/role";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { readActingAsFromCookies } from "@/lib/acting-as.server";
import { fetchOwnerListings } from "@/lib/properties/owner-listings";
import { computeDashboardListings } from "@/lib/properties/host-dashboard";
import { HostListingsManager } from "@/components/host/HostListingsManager";

export const dynamic = "force-dynamic";

export default async function HostListingsPage() {
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
    <div className="space-y-4" data-testid="host-listings-page">
      <HostListingsManager listings={listings} loadError={error} />
    </div>
  );
}
