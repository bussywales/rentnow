export const PROPERTY_SHARE_CHANNELS = ["copy", "whatsapp", "native"] as const;
export type PropertyShareChannel = (typeof PROPERTY_SHARE_CHANNELS)[number];

export const PROPERTY_SHARE_SURFACES = ["property_card", "property_detail"] as const;
export type PropertyShareSurface = (typeof PROPERTY_SHARE_SURFACES)[number];

export function buildPropertyPublicPath(propertyId: string) {
  return `/properties/${encodeURIComponent(propertyId)}`;
}

export function buildPropertyPublicShareUrl(propertyId: string, origin: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}${buildPropertyPublicPath(propertyId)}`;
}

export function buildPropertyWhatsappShareUrl(propertyUrl: string) {
  const message = `Take a look at this property on PropatyHub: ${propertyUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function buildPropertyShareMeta(input: {
  channel: PropertyShareChannel;
  surface: PropertyShareSurface;
}) {
  return {
    source: "public_share",
    channel: input.channel,
    surface: input.surface,
  };
}
