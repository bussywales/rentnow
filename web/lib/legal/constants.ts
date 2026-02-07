export const LEGAL_AUDIENCES = [
  "MASTER",
  "TENANT",
  "LANDLORD_AGENT",
  "ADMIN_OPS",
  "AUP",
  "DISCLAIMER",
] as const;

export type LegalAudience = (typeof LEGAL_AUDIENCES)[number];

export const LEGAL_STATUSES = ["draft", "published", "archived"] as const;
export type LegalDocumentStatus = (typeof LEGAL_STATUSES)[number];

export const DEFAULT_JURISDICTION = "NG";

export const LEGAL_AUDIENCE_LABELS: Record<LegalAudience, string> = {
  MASTER: "Master terms",
  TENANT: "Tenant terms",
  LANDLORD_AGENT: "Landlord/Agent terms",
  ADMIN_OPS: "Admin/Ops terms",
  AUP: "Acceptable use policy",
  DISCLAIMER: "Marketplace disclaimer",
};

export function isLegalAudience(value: string | null | undefined): value is LegalAudience {
  return !!value && (LEGAL_AUDIENCES as readonly string[]).includes(value);
}

export function isLegalStatus(value: string | null | undefined): value is LegalDocumentStatus {
  return !!value && (LEGAL_STATUSES as readonly string[]).includes(value);
}
