import type { UserRole } from "@/lib/types";
import { type LegalAudience } from "@/lib/legal/constants";

const ROLE_AUDIENCE_MAP: Record<UserRole, LegalAudience> = {
  tenant: "TENANT",
  landlord: "LANDLORD_AGENT",
  agent: "LANDLORD_AGENT",
  admin: "ADMIN_OPS",
};

const BASE_REQUIRED: LegalAudience[] = ["MASTER", "AUP"];

export function getLegalAudienceForRole(role: UserRole): LegalAudience {
  return ROLE_AUDIENCE_MAP[role];
}

export function getRequiredLegalAudiences(role: UserRole | null): LegalAudience[] {
  if (!role) return [...BASE_REQUIRED];
  const roleAudience = getLegalAudienceForRole(role);
  const audiences = [...BASE_REQUIRED, roleAudience];
  return Array.from(new Set(audiences));
}
