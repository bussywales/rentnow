import { redirect } from "next/navigation";
import OnboardingRoleClient from "@/components/onboarding/OnboardingRoleClient";
import { resolveServerRole } from "@/lib/auth/role";
import { resolvePostLoginRedirect } from "@/lib/auth/post-login-redirect";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { user, role } = await resolveServerRole();

  if (user && role) {
    redirect(resolvePostLoginRedirect({ role }));
  }

  return <OnboardingRoleClient />;
}
