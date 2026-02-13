import { RoleHelpIndex } from "@/components/help/RoleHelpPage";

export const dynamic = "force-dynamic";

export default function AgentRoleHelpPage() {
  return (
    <RoleHelpIndex
      role="agent"
      title="Agent Help Centre"
      subtitle="Run portfolio workflows at scale: listings, leads, featured campaigns, and operational quality."
    />
  );
}
