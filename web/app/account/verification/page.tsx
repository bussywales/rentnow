import { redirect } from "next/navigation";
import VerificationCenterClient from "@/components/verification/VerificationCenterClient";
import { getProfile } from "@/lib/auth";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { normalizeRole } from "@/lib/roles";
import { getVerificationRequirements } from "@/lib/settings/app-settings.server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getVerificationStatus } from "@/lib/verification/status";

export const dynamic = "force-dynamic";

export default async function AccountVerificationPage() {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Supabase env missing. Verification center unavailable.
        </div>
      </div>
    );
  }

  const { user, supabase } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/required?redirect=/account/verification&reason=auth");
  }

  const [status, requirements, profile] = await Promise.all([
    getVerificationStatus({ userId: user.id }),
    getVerificationRequirements(supabase),
    getProfile(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <VerificationCenterClient
        initialStatus={status}
        requirements={requirements}
        initialEmail={user.email}
        viewerRole={normalizeRole(profile?.role)}
      />
    </div>
  );
}
