import { redirect } from "next/navigation";
import { PropertyStepper } from "@/components/properties/PropertyStepper";
import { resolveServerRole } from "@/lib/auth/role";
import { canManageListings } from "@/lib/role-access";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";

export const dynamic = "force-dynamic";

export default async function NewPropertyPage() {
  const { user, role } = await resolveServerRole();
  if (!user) {
    logAuthRedirect("/dashboard/properties/new");
    redirect("/auth/login?reason=auth");
  }
  if (!role) {
    redirect("/onboarding");
  }
  if (!canManageListings(role)) {
    redirect("/tenant");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Create listing</h1>
        <p className="text-sm text-slate-600">
          Add details, upload photos via Supabase Storage, and publish when ready.
        </p>
      </div>
      <PropertyStepper />
    </div>
  );
}
