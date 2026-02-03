import { isIdentityVerified, type TrustMarkerState } from "@/lib/trust-markers";

export type TrustCue = {
  key: "verified_host" | "fast_responder" | "new_listing";
  label: string;
};

const NEW_LISTING_DAYS = 7;

export function isNewListing(createdAt?: string | null, now: Date = new Date()): boolean {
  if (!createdAt) return false;
  const createdTime = Date.parse(createdAt);
  if (Number.isNaN(createdTime)) return false;
  const diffMs = now.getTime() - createdTime;
  return diffMs >= 0 && diffMs <= NEW_LISTING_DAYS * 24 * 60 * 60 * 1000;
}

export function buildTrustCues({
  markers,
  fastResponder,
  createdAt,
  now = new Date(),
}: {
  markers?: TrustMarkerState | null;
  fastResponder?: boolean;
  createdAt?: string | null;
  now?: Date;
}): TrustCue[] {
  const cues: TrustCue[] = [];
  if (isIdentityVerified(markers)) {
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
