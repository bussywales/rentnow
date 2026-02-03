import { HelpComingSoon } from "@/components/help/HelpComingSoon";
import { HelpPageShell } from "@/components/help/HelpPageShell";

export const dynamic = "force-dynamic";

export default function ListingsOverviewHelpPage() {
  return (
    <HelpPageShell
      title="Listings overview"
      subtitle="How listings move from draft to live, including paused and expired states."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Listings", href: "/help/admin/listings" },
        { label: "Overview" },
      ]}
    >
      <HelpComingSoon
        title="Overview playbook coming soon"
        description="This page will outline the full listings lifecycle, ownership, and key checks."
        links={[
          { label: "Review workflow", href: "/help/admin/listings/review-workflow" },
          { label: "Statuses", href: "/help/admin/listings/statuses" },
        ]}
      />
    </HelpPageShell>
  );
}
