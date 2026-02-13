import { RoleHelpIndex } from "@/components/help/RoleHelpPage";

export const dynamic = "force-dynamic";

export default function AdminHelpPage() {
  return (
    <RoleHelpIndex
      role="admin"
      title="Admin Help Centre"
      subtitle="Operational guides for updates, featured queues, payments, alerts, and system health."
    />
  );
}
