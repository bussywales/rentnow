export const APP_SETTING_KEYS = {
  showTenantPhotoTrustSignals: "show_tenant_photo_trust_signals",
  enableLocationPicker: "enable_location_picker",
  showTenantCheckinBadge: "show_tenant_checkin_badge",
  requireLocationPinForPublish: "require_location_pin_for_publish",
  contactExchangeMode: "contact_exchange_mode",
  listingExpiryDays: "listing_expiry_days",
  showExpiredListingsPublic: "show_expired_listings_public",
  agentStorefrontsEnabled: "agent_storefronts_enabled",
} as const;

export type AppSettingKey = (typeof APP_SETTING_KEYS)[keyof typeof APP_SETTING_KEYS];

export const APP_SETTING_KEY_LIST = Object.values(APP_SETTING_KEYS) as AppSettingKey[];
