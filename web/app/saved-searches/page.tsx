import { redirect } from "next/navigation";
import { resolveServerRole } from "@/lib/auth/role";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";

export const dynamic = "force-dynamic";

export default async function SavedSearchesRedirectPage() {
  const { user, role } = await resolveServerRole();

  if (!user) {
    logAuthRedirect("/saved-searches");
    redirect("/auth/login?reason=auth&redirect=/saved-searches");
  }

  if (!role) {
    redirect("/onboarding");
  }

  if (role === "tenant") {
    redirect("/tenant/saved-searches");
  }

  redirect("/dashboard/saved-searches");
}
