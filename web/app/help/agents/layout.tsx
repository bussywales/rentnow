import { redirect } from "next/navigation";
import { resolveServerRole } from "@/lib/auth/role";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { HelpSidebar } from "@/components/help/HelpSidebar";
import { HELP_AGENT_NAV } from "@/components/help/help-nav";

export const dynamic = "force-dynamic";

export default async function AgentHelpLayout({ children }: { children: React.ReactNode }) {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/help/agents&reason=auth");
  }

  const { user, role } = await resolveServerRole();
  if (!user) {
    redirect("/auth/required?redirect=/help/agents&reason=auth");
  }

  if (role !== "agent" && role !== "landlord") {
    redirect("/forbidden?reason=role");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8" data-testid="help-agent-layout">
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <HelpSidebar sections={HELP_AGENT_NAV} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
