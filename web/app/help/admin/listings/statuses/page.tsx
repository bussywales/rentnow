import { HelpComingSoon } from "@/components/help/HelpComingSoon";
import { HelpPageShell } from "@/components/help/HelpPageShell";

export const dynamic = "force-dynamic";

export default function ListingsStatusesHelpPage() {
  return (
    <HelpPageShell
      title="Listings statuses"
      subtitle="Definitions and allowed transitions for each listing status."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Listings", href: "/help/admin/listings" },
        { label: "Statuses" },
      ]}
    >
      <HelpComingSoon
        title="Statuses reference coming soon"
        description="We are documenting each status, what it means to tenants, and the safe transitions."
        links={[
          { label: "Review workflow", href: "/help/admin/listings/review-workflow" },
          { label: "Listings overview", href: "/help/admin/listings/overview" },
        ]}
      />
    </HelpPageShell>
  );
}
