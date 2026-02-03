import { redirect } from "next/navigation";
import { PropertyStepper } from "@/components/properties/PropertyStepper";
import { resolveServerRole } from "@/lib/auth/role";
import { canManageListings } from "@/lib/role-access";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { normalizeFocusParam, normalizeStepParam, type StepId } from "@/lib/properties/step-params";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function resolveStep(searchParams?: Props["searchParams"]): StepId {
  const raw = searchParams?.step;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return normalizeStepParam(value);
}

function resolveFocus(searchParams?: Props["searchParams"]): "location" | "photos" | null {
  const raw = searchParams?.focus;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return normalizeFocusParam(value);
}

export default async function NewPropertyPage({ searchParams }: Props) {
  const { user, role } = await resolveServerRole();
  if (!user) {
    logAuthRedirect("/dashboard/properties/new");
    redirect("/auth/login?reason=auth");
  }
  if (!role) {
    redirect("/onboarding");
  }
  if (!canManageListings(role)) {
    redirect("/tenant/home");
  }

  const enableLocationPicker = await getAppSettingBool("enable_location_picker", false);
  const requireLocationPinForPublish = await getAppSettingBool(
    "require_location_pin_for_publish",
    false
  );
  const initialStep = resolveStep(searchParams);
  const initialFocus = resolveFocus(searchParams);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Create listing</h1>
        <p className="text-sm text-slate-600">
          Add details, upload photos via Supabase Storage, and publish when ready.
        </p>
      </div>
      <PropertyStepper
        enableLocationPicker={enableLocationPicker}
        requireLocationPinForPublish={requireLocationPinForPublish}
        initialStep={initialStep}
        initialFocus={initialFocus}
      />
    </div>
  );
}
