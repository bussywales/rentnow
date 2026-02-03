import { HelpComingSoon } from "@/components/help/HelpComingSoon";
import { HelpPageShell } from "@/components/help/HelpPageShell";

export const dynamic = "force-dynamic";

export default function ListingsFeaturedHelpPage() {
  return (
    <HelpPageShell
      title="Featured listings"
      subtitle="How to feature inventory, schedule expiry, and read performance signals."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Listings", href: "/help/admin/listings" },
        { label: "Featured" },
      ]}
    >
      <HelpComingSoon
        title="Featured operations guide coming soon"
        description="This guide will cover ranking, scheduling, and interpreting featured performance."
        links={[
          { label: "Review workflow", href: "/help/admin/listings/review-workflow" },
          { label: "Analytics", href: "/help/admin/analytics" },
        ]}
      />
    </HelpPageShell>
  );
}
