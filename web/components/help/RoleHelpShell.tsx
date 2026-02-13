import { HelpSidebar } from "@/components/help/HelpSidebar";
import { buildHelpNavForRole, type HelpRole } from "@/lib/help/docs";

export async function RoleHelpShell({
  role,
  children,
}: {
  role: HelpRole;
  children: React.ReactNode;
}) {
  const sections = await buildHelpNavForRole(role);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8" data-testid={`help-${role}-layout`}>
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <HelpSidebar sections={sections} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
