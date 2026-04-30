import { redirect } from "next/navigation";
import AgentOnboardingClient from "@/components/onboarding/AgentOnboardingClient";
import { resolveServerRole } from "@/lib/auth/role";
import { resolvePostLoginRedirect } from "@/lib/auth/post-login-redirect";

export const dynamic = "force-dynamic";

export default async function AgentOnboardingPage() {
  const { user, role } = await resolveServerRole();

  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent("/onboarding/agent")}`);
  }

  if (!role) {
    redirect("/onboarding");
  }

  if (role !== "agent") {
    redirect(resolvePostLoginRedirect({ role }));
  }

  return <AgentOnboardingClient />;
}
