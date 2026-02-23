export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/role";
import { formatRoleLabel, normalizeRole } from "@/lib/roles";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  if (!hasServerSupabaseEnv()) {
    return <>{children}</>;
  }

  const { supabase, user, role } = await resolveServerRole();
  if (!user) {
    return <>{children}</>;
  }

  const normalizedRole = normalizeRole(role);
  const shouldUseWorkspaceShell =
    normalizedRole === "agent" || normalizedRole === "landlord" || normalizedRole === "admin";
  if (!shouldUseWorkspaceShell) {
    return <>{children}</>;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const roleLabel = formatRoleLabel(normalizedRole);
  const workspaceTitle = `${profile?.full_name || "Your"} workspace`;
  const workspaceCopy = `Role: ${roleLabel} - Manage listings, messages, and viewings.`;

  return (
    <WorkspaceShell role={normalizedRole} title={workspaceTitle} subtitle={workspaceCopy}>
      {children}
    </WorkspaceShell>
  );
}
