import { redirect } from "next/navigation";
import { resolveServerRole } from "@/lib/auth/role";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { ExploreAnalyticsPanel } from "@/components/tenant/ExploreAnalyticsPanel";

export const dynamic = "force-dynamic";

export default async function TenantExploreAnalyticsPage() {
  if (hasServerSupabaseEnv()) {
    const { user, role } = await resolveServerRole();
    if (!user) {
      logAuthRedirect("/tenant/debug/explore-analytics");
      redirect("/auth/login?reason=auth");
    }
    if (!role) {
      redirect("/onboarding");
    }
    if (role !== "tenant") {
      redirect(role === "admin" ? "/admin/support" : "/host");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <ExploreAnalyticsPanel />
    </div>
  );
}
