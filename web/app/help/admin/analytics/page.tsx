import { HelpComingSoon } from "@/components/help/HelpComingSoon";
import { HelpPageShell } from "@/components/help/HelpPageShell";

export const dynamic = "force-dynamic";

export default function AnalyticsHelpPage() {
  return (
    <HelpPageShell
      title="Analytics and performance"
      subtitle="How to read demand signals, featured performance, and missed demand."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Analytics" },
      ]}
    >
      <HelpComingSoon
        title="Analytics guide coming soon"
        description="This page will explain demand metrics, featured performance, and when to take action."
        links={[
          { label: "Featured listings", href: "/help/admin/listings/featured" },
          { label: "Listings review workflow", href: "/help/admin/listings/review-workflow" },
        ]}
      />
    </HelpPageShell>
  );
}
