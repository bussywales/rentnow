import type { UserRole } from "@/lib/types";
import {
  PRODUCT_UPDATE_AUDIENCE_BY_ROLE,
  PRODUCT_UPDATE_AUDIENCES,
  type ProductUpdateAudience,
} from "@/lib/product-updates/constants";

export function getAllowedProductUpdateAudiences(
  role: UserRole | null
): ProductUpdateAudience[] {
  if (!role) return ["all"];
  if (role === "admin") return [...PRODUCT_UPDATE_AUDIENCES];
  return PRODUCT_UPDATE_AUDIENCE_BY_ROLE[role] ?? ["all"];
}

export function isProductUpdateAudience(value: string | null | undefined): value is ProductUpdateAudience {
  if (!value) return false;
  return (PRODUCT_UPDATE_AUDIENCES as readonly string[]).includes(value);
}

export function isUpdateVisibleForRole(
  audience: ProductUpdateAudience,
  role: UserRole | null
): boolean {
  return getAllowedProductUpdateAudiences(role).includes(audience);
}

export type ProductUpdateSummary = {
  id: string;
  audience: ProductUpdateAudience;
  published_at?: string | null;
};

export function filterPublishedUpdatesForRole(
  updates: ProductUpdateSummary[],
  role: UserRole | null
): ProductUpdateSummary[] {
  return updates.filter(
    (update) => !!update.published_at && isUpdateVisibleForRole(update.audience, role)
  );
}

export function countUnreadUpdates(
  updates: Array<{ id: string }>,
  reads: Array<{ update_id: string }>
): number {
  if (!updates.length) return 0;
  const readSet = new Set(reads.map((row) => row.update_id));
  return updates.reduce((count, update) => count + (readSet.has(update.id) ? 0 : 1), 0);
}
