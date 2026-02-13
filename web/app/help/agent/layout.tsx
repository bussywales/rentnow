import { RoleHelpShell } from "@/components/help/RoleHelpShell";

export const dynamic = "force-dynamic";

export default async function AgentRoleHelpLayout({ children }: { children: React.ReactNode }) {
  return <RoleHelpShell role="agent">{children}</RoleHelpShell>;
}
