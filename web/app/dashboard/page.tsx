import { redirect } from "next/navigation";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/role";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";

export const dynamic = "force-dynamic";

export default async function DashboardRouter() {
  if (!hasServerSupabaseEnv()) {
    redirect("/properties");
  }

  const { user, role } = await resolveServerRole();

  if (!user) {
    logAuthRedirect("/dashboard");
    redirect("/auth/login?reason=auth");
  }

  if (!role) {
    redirect("/onboarding");
  }

  if (role === "tenant") {
    redirect("/tenant");
  }

  if (role === "admin") {
    redirect("/admin");
  }

  redirect("/host");
}
