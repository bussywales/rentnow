import { redirect } from "next/navigation";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { resolveServerRole } from "@/lib/auth/role";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TenantSavedPage() {
  if (!hasServerSupabaseEnv()) {
    redirect("/favourites");
  }

  const { user, role } = await resolveServerRole();
  if (!user) {
    logAuthRedirect("/tenant/saved");
    redirect("/auth/login?reason=auth");
  }
  if (!role) {
    redirect("/onboarding");
  }
  if (role !== "tenant") {
    redirect(role === "admin" ? "/admin/support" : "/host");
  }

  redirect("/favourites");
}
