import { RoleHelpShell } from "@/components/help/RoleHelpShell";

export const dynamic = "force-dynamic";

export default async function TenantHelpLayout({ children }: { children: React.ReactNode }) {
  return <RoleHelpShell role="tenant">{children}</RoleHelpShell>;
}
