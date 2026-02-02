export const DEFAULT_LISTING_EXPIRY_DAYS = 90;
export const MIN_LISTING_EXPIRY_DAYS = 7;
export const MAX_LISTING_EXPIRY_DAYS = 365;

export type ListingVisibilityInput = {
  status?: string | null;
  is_active?: boolean | null;
  is_approved?: boolean | null;
  expires_at?: string | null;
};

export function normalizeListingExpiryDays(
  value: number,
  fallback: number = DEFAULT_LISTING_EXPIRY_DAYS
): number {
  const fallbackSafe = Math.min(
    Math.max(Math.trunc(fallback), MIN_LISTING_EXPIRY_DAYS),
    MAX_LISTING_EXPIRY_DAYS
  );
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallbackSafe;
  const intVal = Math.trunc(numeric);
  if (intVal < MIN_LISTING_EXPIRY_DAYS) return MIN_LISTING_EXPIRY_DAYS;
  if (intVal > MAX_LISTING_EXPIRY_DAYS) return MAX_LISTING_EXPIRY_DAYS;
  return intVal;
}

export function computeExpiryAt(baseDate: Date | string, expiryDays: number): string {
  const base = baseDate instanceof Date ? baseDate : new Date(baseDate);
  const baseMs = Number.isFinite(base.getTime()) ? base.getTime() : Date.now();
  const days = normalizeListingExpiryDays(expiryDays);
  const expiryMs = baseMs + days * 24 * 60 * 60 * 1000;
  return new Date(expiryMs).toISOString();
}

export function isListingExpired(listing: ListingVisibilityInput, now: Date = new Date()): boolean {
  const status = (listing.status ?? "").toString().trim().toLowerCase();
  if (status === "expired") return true;
  if (status !== "live") return false;
  if (!listing.expires_at) return false;
  const expiresMs = Date.parse(listing.expires_at);
  return Number.isFinite(expiresMs) ? expiresMs < now.getTime() : false;
}

export function isListingPubliclyVisible(listing: ListingVisibilityInput, now: Date = new Date()): boolean {
  const status = (listing.status ?? "").toString().trim().toLowerCase();
  if (status !== "live") return false;
  if (listing.is_approved !== true || listing.is_active !== true) return false;
  if (!listing.expires_at) return true;
  const expiresMs = Date.parse(listing.expires_at);
  if (!Number.isFinite(expiresMs)) return true;
  return expiresMs >= now.getTime();
}

export function canShowExpiredListingPublic(
  listing: ListingVisibilityInput,
  showExpiredPublic: boolean,
  now: Date = new Date()
): boolean {
  if (!showExpiredPublic) return false;
  if (listing.is_approved !== true) return false;
  return isListingExpired(listing, now);
}

export function buildRenewalUpdate(params: {
  now: Date;
  expiryDays: number;
}) {
  const nowIso = params.now.toISOString();
  return {
    status: "live",
    is_active: true,
    is_approved: true,
    renewed_at: nowIso,
    expired_at: null,
    expires_at: computeExpiryAt(params.now, params.expiryDays),
    updated_at: nowIso,
  };
}

export function buildLiveApprovalUpdate(params: {
  now: Date;
  expiryDays: number;
}) {
  const nowIso = params.now.toISOString();
  return {
    status: "live",
    is_approved: true,
    is_active: true,
    approved_at: nowIso,
    rejection_reason: null,
    rejected_at: null,
    expired_at: null,
    expires_at: computeExpiryAt(params.now, params.expiryDays),
  };
}
