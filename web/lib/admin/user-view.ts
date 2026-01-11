import { normalizeRole } from "@/lib/roles";

type AdminProfile = {
  role?: string | null;
  onboarding_completed?: boolean | null;
};

export function getAdminAccessState(profile: AdminProfile | null) {
  const role = normalizeRole(profile?.role ?? null);
  const onboardingCompleted = profile?.onboarding_completed === true;
  const isAdmin = role === "admin";
  const actionsDisabled = !onboardingCompleted;
  const showOnboardingBanner = isAdmin && !onboardingCompleted;

  return {
    isAdmin,
    onboardingCompleted,
    actionsDisabled,
    showOnboardingBanner,
  };
}

export function shouldShowProfileMissing(profile: { id: string } | null, serviceReady: boolean) {
  return serviceReady && !profile;
}
