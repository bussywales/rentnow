export const ADMIN_REVIEW_DENSITY_KEY = "admin.review.density";

export type AdminReviewDensity = "comfortable" | "compact";

export function normalizeReviewDensity(value: string | null | undefined): AdminReviewDensity {
  return value === "compact" ? "compact" : "comfortable";
}

export function loadReviewDensity(
  storage?: Pick<Storage, "getItem">
): AdminReviewDensity {
  if (!storage) return "comfortable";
  return normalizeReviewDensity(storage.getItem(ADMIN_REVIEW_DENSITY_KEY));
}

export function saveReviewDensity(
  storage: Pick<Storage, "setItem">,
  density: AdminReviewDensity
) {
  storage.setItem(ADMIN_REVIEW_DENSITY_KEY, density);
}
