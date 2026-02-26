import {
  isAdvertiserVerified,
  type TrustMarkerState,
  type VerificationRequirements,
} from "@/lib/trust-markers";

export type TrustCue = {
  key: "verified_host" | "fast_responder" | "new_listing";
  label: string;
};

const NEW_LISTING_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function isNewListing(createdAt?: string | null, now: Date = new Date()): boolean {
  if (!createdAt) return false;
  const createdTime = Date.parse(createdAt);
  if (Number.isNaN(createdTime)) return false;
  const nowDay = Math.floor(now.getTime() / DAY_IN_MS);
  const createdDay = Math.floor(createdTime / DAY_IN_MS);
  const diffDays = nowDay - createdDay;
  return diffDays >= 0 && diffDays <= NEW_LISTING_DAYS;
}

export function buildTrustCues({
  markers,
  verificationRequirements,
  fastResponder,
  createdAt,
  now = new Date(),
}: {
  markers?: TrustMarkerState | null;
  verificationRequirements?: Partial<VerificationRequirements> | null;
  fastResponder?: boolean;
  createdAt?: string | null;
  now?: Date;
}): TrustCue[] {
  const cues: TrustCue[] = [];
  if (isAdvertiserVerified(markers, verificationRequirements)) {
    cues.push({ key: "verified_host", label: "Verified host" });
  }
  if (fastResponder) {
    cues.push({ key: "fast_responder", label: "Fast responder" });
  }
  if (isNewListing(createdAt, now)) {
    cues.push({ key: "new_listing", label: "New listing" });
  }
  return cues;
}
