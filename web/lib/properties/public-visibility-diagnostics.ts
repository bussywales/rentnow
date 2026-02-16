import { isListingPubliclyVisible } from "@/lib/properties/expiry";

type VisibilityDiagnosticsInput = {
  status?: string | null;
  is_active?: boolean | null;
  is_approved?: boolean | null;
  expires_at?: string | null;
  is_demo?: boolean | null;
};

export type VisibilityDiagnostics = {
  isVisible: boolean;
  blockers: string[];
};

export function getPublicVisibilityDiagnostics(
  listing: VisibilityDiagnosticsInput,
  now: Date = new Date()
): VisibilityDiagnostics {
  const status = (listing.status ?? "").toString().trim().toLowerCase();
  const blockers: string[] = [];

  if (status !== "live") {
    blockers.push("Status is not live yet.");
  }
  if (listing.is_approved !== true) {
    blockers.push("Listing is awaiting approval.");
  }
  if (listing.is_active !== true) {
    blockers.push("Listing is inactive.");
  }
  if (listing.is_demo) {
    blockers.push("Demo listings are hidden from public browse.");
  }
  if (status === "live" && listing.expires_at) {
    const expiresMs = Date.parse(listing.expires_at);
    if (Number.isFinite(expiresMs) && expiresMs < now.getTime()) {
      blockers.push("Listing has expired.");
    }
  }

  const isVisible = isListingPubliclyVisible(listing, now) && !listing.is_demo;
  return { isVisible, blockers };
}
