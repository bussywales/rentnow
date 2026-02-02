import type { UserRole } from "@/lib/types";
import { type LegalAudience } from "@/lib/legal/constants";

const ROLE_AUDIENCE_MAP: Record<UserRole, LegalAudience> = {
  tenant: "TENANT",
  landlord: "LANDLORD_AGENT",
  agent: "LANDLORD_AGENT",
  admin: "ADMIN_OPS",
};

const BASE_REQUIRED: LegalAudience[] = ["MASTER", "AUP"];
const ROLE_PRIORITY: UserRole[] = ["admin", "tenant", "landlord", "agent"];

export function getLegalAudienceForRole(role: UserRole): LegalAudience {
  return ROLE_AUDIENCE_MAP[role];
}

function normalizeRoles(input: UserRole | UserRole[] | null): UserRole[] {
  if (!input) return [];
  const roles = Array.isArray(input) ? input : [input];
  return ROLE_PRIORITY.filter((role) => roles.includes(role));
}

export function getRequiredLegalAudiences(
  role: UserRole | UserRole[] | null
): LegalAudience[] {
  const audiences = [...BASE_REQUIRED];
  const roles = normalizeRoles(role);

  roles.forEach((roleValue) => {
    const audience = getLegalAudienceForRole(roleValue);
    if (!audiences.includes(audience)) {
      audiences.push(audience);
    }
  });

  return audiences;
}
