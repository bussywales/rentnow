import { redirect } from "next/navigation";
import { resolveServerRole } from "@/lib/auth/role";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/roles";
import { HelpSidebar } from "@/components/help/HelpSidebar";
import { HELP_ADMIN_NAV } from "@/components/help/help-nav";

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
    <div
      className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8"
      data-testid="help-layout"
    >
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <HelpSidebar sections={HELP_ADMIN_NAV} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
