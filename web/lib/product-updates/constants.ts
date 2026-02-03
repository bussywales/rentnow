import type { UserRole } from "@/lib/types";

export const PRODUCT_UPDATE_AUDIENCES = ["all", "tenant", "host", "admin"] as const;
export type ProductUpdateAudience = (typeof PRODUCT_UPDATE_AUDIENCES)[number];

export const PRODUCT_UPDATE_AUDIENCE_LABELS: Record<ProductUpdateAudience, string> = {
  all: "All users",
  tenant: "Tenants",
  host: "Hosts",
  admin: "Admins",
};

export const PRODUCT_UPDATE_AUDIENCE_BY_ROLE: Record<UserRole, ProductUpdateAudience[]> = {
  tenant: ["all", "tenant"],
  landlord: ["all", "host"],
  agent: ["all", "host"],
  admin: ["all", "admin"],
};
