import { redirect } from "next/navigation";
import { resolveServerRole } from "@/lib/auth/role";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HostHelpLayout({ children }: { children: React.ReactNode }) {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/help/host/performance&reason=auth");
  }

  const { user, role } = await resolveServerRole();
  if (!user) {
    redirect("/auth/required?redirect=/help/host/performance&reason=auth");
  }

  if (role !== "landlord" && role !== "agent") {
    redirect("/forbidden?reason=role");
  }

  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>;
}
