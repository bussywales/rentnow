import { redirect } from "next/navigation";
import { resolveServerRole } from "@/lib/auth/role";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";

export const dynamic = "force-dynamic";

export default async function SavedSearchesRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<{ alerts?: string }>;
}) {
  const { user, role } = await resolveServerRole();
  const params = (await searchParams) ?? {};
  const alertsSuffix = params.alerts ? `?alerts=${encodeURIComponent(params.alerts)}` : "";

  if (!user) {
    logAuthRedirect("/saved-searches");
    redirect("/auth/login?reason=auth&redirect=/saved-searches");
  }

  if (!role) {
    redirect("/onboarding");
  }

  if (role === "tenant") {
    redirect(`/tenant/saved-searches${alertsSuffix}`);
  }

  redirect(`/dashboard/saved-searches${alertsSuffix}`);
}
