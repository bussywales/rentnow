import type { UserRole } from "@/lib/types";
import { HELP_ROLE_LABELS, type HelpRole } from "@/lib/help/docs";

export const PUBLIC_HELP_ROLES: HelpRole[] = ["tenant", "landlord", "agent"];
export const INTERNAL_HELP_ROLES: HelpRole[] = ["admin"];

export type HelpVisibilityModel = {
  publicRoles: HelpRole[];
  internalRoles: HelpRole[];
  showInternalAdminHelp: boolean;
};

export function getHelpVisibilityModel(viewerRole: UserRole | null): HelpVisibilityModel {
  const showInternalAdminHelp = viewerRole === "admin";
  return {
    publicRoles: PUBLIC_HELP_ROLES,
    internalRoles: showInternalAdminHelp ? INTERNAL_HELP_ROLES : [],
    showInternalAdminHelp,
  };
}

export function getHelpAudienceLabel(role: HelpRole) {
  if (role === "admin") return "Internal Admin & Ops Help";
  return `${HELP_ROLE_LABELS[role]} guides`;
}
