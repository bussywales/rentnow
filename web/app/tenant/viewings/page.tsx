import { redirect } from "next/navigation";
import ViewingsPage from "../../dashboard/viewings/page";
import { resolveServerRole } from "@/lib/auth/role";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";

export const dynamic = "force-dynamic";

export default async function TenantViewingsPage() {
  if (hasServerSupabaseEnv()) {
    const { user, role } = await resolveServerRole();
    if (!user) {
      logAuthRedirect("/tenant/viewings");
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
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 lg:px-8">
      <ViewingsPage />
    </div>
  );
}
