import { RoleHelpIndex } from "@/components/help/RoleHelpPage";

export const dynamic = "force-dynamic";

export default function AdminHelpPage() {
  return (
    <RoleHelpIndex
      role="admin"
      title="Internal Admin & Ops Help"
      subtitle="Internal operational guides for updates, listings, payments, moderation, alerts, and system health."
    />
  );
}
