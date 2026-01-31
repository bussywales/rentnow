import { redirect } from "next/navigation";
import VerificationCenterClient from "@/components/verification/VerificationCenterClient";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { getProfile } from "@/lib/auth";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { normalizeRole } from "@/lib/roles";
import { getVerificationStatus } from "@/lib/verification/status";

export const dynamic = "force-dynamic";

export default async function VerificationCenterPage() {
  if (!hasServerSupabaseEnv()) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Supabase env missing. Verification center unavailable.
      </div>
    );
  }

  const { user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/login?reason=auth");
  }

  const profile = await getProfile();
  const role = normalizeRole(profile?.role);
  if (!role || role === "tenant") {
    redirect("/dashboard");
  }

  const status = await getVerificationStatus({ userId: user.id });

  return (
    <div className="space-y-6">
      <VerificationCenterClient initialStatus={status} initialEmail={user.email} />
    </div>
  );
}
