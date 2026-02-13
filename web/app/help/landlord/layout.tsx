import { RoleHelpShell } from "@/components/help/RoleHelpShell";

export const dynamic = "force-dynamic";

export default async function LandlordHelpLayout({ children }: { children: React.ReactNode }) {
  return <RoleHelpShell role="landlord">{children}</RoleHelpShell>;
}
