export const ADVERTISER_SHARE_CHANNELS = ["copy", "whatsapp", "native"] as const;
export type AdvertiserShareChannel = (typeof ADVERTISER_SHARE_CHANNELS)[number];

export const ADVERTISER_SHARE_SURFACES = ["agent_profile"] as const;
export type AdvertiserShareSurface = (typeof ADVERTISER_SHARE_SURFACES)[number];

export function getPublicProfileUrl(origin: string, slug: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}/agents/${encodeURIComponent(slug)}`;
}

export function getWhatsAppProfileShareUrl(
  origin: string,
  slug: string,
  displayName?: string | null
) {
  const profileUrl = getPublicProfileUrl(origin, slug);
  const trimmedName = typeof displayName === "string" ? displayName.trim() : "";
  const message = trimmedName
    ? `Hi! View ${trimmedName}'s listings on PropatyHub: ${profileUrl}`
    : `Hi! View listings on PropatyHub: ${profileUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
