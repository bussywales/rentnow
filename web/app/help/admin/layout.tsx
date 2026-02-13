import { redirect } from "next/navigation";
import { resolveServerRole } from "@/lib/auth/role";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";
import { RoleHelpShell } from "@/components/help/RoleHelpShell";

export const dynamic = "force-dynamic";

export default async function AdminHelpLayout({ children }: { children: React.ReactNode }) {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/help/admin&reason=auth");
  }

  const { user, role } = await resolveServerRole();
  if (!user) {
    redirect("/auth/required?redirect=/help/admin&reason=auth");
  }

  if (!isAdminRole(role)) {
    redirect("/forbidden?reason=role");
  }

  return (
    <RoleHelpShell role="admin">{children}</RoleHelpShell>
  );
}
