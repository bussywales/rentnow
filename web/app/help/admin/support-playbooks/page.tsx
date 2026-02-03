import { HelpComingSoon } from "@/components/help/HelpComingSoon";
import { HelpPageShell } from "@/components/help/HelpPageShell";

export const dynamic = "force-dynamic";

export default function SupportPlaybooksHelpPage() {
  return (
    <HelpPageShell
      title="Support playbooks"
      subtitle="Standard responses and escalation paths for tenant and host support."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Support playbooks" },
      ]}
    >
      <HelpComingSoon
        title="Support playbooks coming soon"
        description="Use this section for repeatable response templates and escalation notes."
        links={[
          { label: "User management", href: "/help/admin/users" },
          { label: "Listings review workflow", href: "/help/admin/listings/review-workflow" },
        ]}
      />
    </HelpPageShell>
  );
}
