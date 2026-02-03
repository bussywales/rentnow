import { HelpComingSoon } from "@/components/help/HelpComingSoon";
import { HelpPageShell } from "@/components/help/HelpPageShell";

export const dynamic = "force-dynamic";

export default function ProductUpdatesHelpPage() {
  return (
    <HelpPageShell
      title="Product updates"
      subtitle="How to draft, publish, and communicate updates to the right audience."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "Product updates" },
      ]}
    >
      <HelpComingSoon
        title="Product updates guide coming soon"
        description="This guide will outline the recommended cadence, tone, and checklist before publishing."
        links={[
          { label: "Admin Help Centre", href: "/help/admin" },
          { label: "Admin updates console", href: "/admin/product-updates" },
        ]}
      />
    </HelpPageShell>
  );
}
