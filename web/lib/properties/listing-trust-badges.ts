import { isNewListing } from "@/lib/trust-cues";
import {
  isAdvertiserIdentityPending,
  isAdvertiserVerified,
  type TrustMarkerState,
  type VerificationRequirements,
} from "@/lib/trust-markers";

export type ListingSocialProof = {
  popular: boolean;
  savedBucket: "Saved 10+" | "Saved 50+" | "Saved 100+" | null;
  viewBucket: "Viewed 100+" | "Viewed 500+" | "Viewed 1k+" | null;
};

export type ListingTrustBadgeKey =
  | "verified"
  | "identity_pending"
  | "popular"
  | "new"
  | "saved_bucket"
  | "view_bucket";

export type ListingTrustBadge = {
  key: ListingTrustBadgeKey;
  label: string;
};

export function hasIdentityVerificationSignals(
  markers?: TrustMarkerState | null
): boolean {
  if (!markers) return false;
  return (
    markers.email_verified !== null &&
      markers.email_verified !== undefined
    ) ||
    (markers.phone_verified !== null &&
      markers.phone_verified !== undefined) ||
    (markers.bank_verified !== null && markers.bank_verified !== undefined);
}

export function resolveListingSocialProof(input: {
  savedCount: number;
  viewCount: number;
  popular: boolean;
}): ListingSocialProof {
  const saved = Math.max(0, Math.trunc(input.savedCount || 0));
  const views = Math.max(0, Math.trunc(input.viewCount || 0));

  const savedBucket =
    saved >= 100 ? "Saved 100+" : saved >= 50 ? "Saved 50+" : saved >= 10 ? "Saved 10+" : null;
  const viewBucket =
    views >= 1000
      ? "Viewed 1k+"
      : views >= 500
      ? "Viewed 500+"
      : views >= 100
      ? "Viewed 100+"
      : null;

  return {
    popular: !!input.popular,
    savedBucket,
    viewBucket,
  };
}

export function buildListingTrustBadges(input: {
  markers?: TrustMarkerState | null;
  verificationRequirements?: Partial<VerificationRequirements> | null;
  createdAt?: string | null;
  socialProof?: ListingSocialProof | null;
  now?: Date;
  maxBadges?: number;
}): ListingTrustBadge[] {
  const now = input.now ?? new Date();
  const maxBadges = input.maxBadges ?? 3;
  const socialProof = input.socialProof ?? null;
  const badges: ListingTrustBadge[] = [];

  const verified = isAdvertiserVerified(input.markers, input.verificationRequirements);
  const identityPending = isAdvertiserIdentityPending(
    input.markers,
    input.verificationRequirements
  );
  const hasSignals = hasIdentityVerificationSignals(input.markers);

  if (verified) {
    badges.push({ key: "verified", label: "Verified" });
  } else if (identityPending && hasSignals) {
    badges.push({ key: "identity_pending", label: "Identity pending" });
  }

  if (socialProof?.popular) {
    badges.push({ key: "popular", label: "Popular this week" });
  }

  if (isNewListing(input.createdAt, now)) {
    badges.push({ key: "new", label: "New" });
  }

  if (socialProof?.savedBucket) {
    badges.push({ key: "saved_bucket", label: socialProof.savedBucket });
  }

  if (socialProof?.viewBucket) {
    badges.push({ key: "view_bucket", label: socialProof.viewBucket });
  }

  return badges.slice(0, Math.max(1, maxBadges));
}
