import { HelpComingSoon } from "@/components/help/HelpComingSoon";
import { HelpPageShell } from "@/components/help/HelpPageShell";

export const dynamic = "force-dynamic";

export default function AdminUsersHelpPage() {
  return (
    <HelpPageShell
      title="User management"
      subtitle="Role changes, account actions, and support notes for user records."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "User management" },
      ]}
    >
      <HelpComingSoon
        title="User management guide coming soon"
        description="We are preparing step-by-step guidance for role changes, resets, and account actions."
        links={[
          { label: "Admin Help Centre", href: "/help/admin" },
          { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        ]}
      />
    </HelpPageShell>
  );
}
