import { redirect } from "next/navigation";
import LandlordOnboardingClient from "@/components/onboarding/LandlordOnboardingClient";
import { resolveServerRole } from "@/lib/auth/role";
import { resolvePostLoginRedirect } from "@/lib/auth/post-login-redirect";

export const dynamic = "force-dynamic";

export default async function LandlordOnboardingPage() {
  const { user, role } = await resolveServerRole();

  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent("/onboarding/landlord")}`);
  }

  if (!role) {
    redirect("/onboarding");
  }

  if (role !== "landlord") {
    redirect(resolvePostLoginRedirect({ role }));
  }

  return <LandlordOnboardingClient />;
}
