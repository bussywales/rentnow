import { redirect } from "next/navigation";
import { HostViewingsList } from "@/components/viewings/HostViewingsList";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/role";

export const dynamic = "force-dynamic";

export default async function ViewingsPage() {
  if (!hasServerSupabaseEnv()) {
    return null;
  }

  const { supabase, user, role } = await resolveServerRole();
  if (!user) redirect("/auth/login?reason=auth");

  if (role === "tenant") {
    redirect("/tenant/viewings");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Viewing requests</h1>
        <p className="text-sm text-slate-600">
          Coordinate tours and confirm availability on your listings. Times are shown in the property’s timezone.
        </p>
      </div>
      <HostViewingsList />
    </div>
  );
}
