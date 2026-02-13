import { RoleHelpIndex } from "@/components/help/RoleHelpPage";

export const dynamic = "force-dynamic";

export default function TenantHelpPage() {
  return (
    <RoleHelpIndex
      role="tenant"
      title="Tenant Help Centre"
      subtitle="Browse confidently, save better shortlists, and stay safe while renting."
    />
  );
}
