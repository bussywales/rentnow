export const APP_SETTING_KEYS = {
  showTenantPhotoTrustSignals: "show_tenant_photo_trust_signals",
  enableLocationPicker: "enable_location_picker",
  showTenantCheckinBadge: "show_tenant_checkin_badge",
  requireLocationPinForPublish: "require_location_pin_for_publish",
  contactExchangeMode: "contact_exchange_mode",
  listingExpiryDays: "listing_expiry_days",
  showExpiredListingsPublic: "show_expired_listings_public",
  agentStorefrontsEnabled: "agent_storefronts_enabled",
  agentNetworkDiscoveryEnabled: "agent_network_discovery_enabled",
  subscriptionsEnabled: "subscriptions_enabled",
  paygListingFeeAmount: "payg_listing_fee_amount",
  paygFeaturedFeeAmount: "payg_featured_fee_amount",
  featuredDurationDays: "featured_duration_days",
  paygEnabled: "payg_enabled",
  trialListingCreditsAgent: "trial_listing_credits_agent",
  trialListingCreditsLandlord: "trial_listing_credits_landlord",
  referralsEnabled: "referrals_enabled",
  referralMaxDepth: "referral_max_depth",
  referralEnabledLevels: "referral_enabled_levels",
  referralRewardRules: "referral_reward_rules",
  referralTierThresholds: "referral_tier_thresholds",
  referralsTierThresholds: "referrals_tier_thresholds",
  referralsMilestonesEnabled: "referrals_milestones_enabled",
  referralsLeaderboardEnabled: "referrals_leaderboard_enabled",
  referralsLeaderboardPublicVisible: "referrals_leaderboard_public_visible",
  referralsLeaderboardMonthlyEnabled: "referrals_leaderboard_monthly_enabled",
  referralsLeaderboardAllTimeEnabled: "referrals_leaderboard_all_time_enabled",
  referralCaps: "referral_caps",
} as const;

export type AppSettingKey = (typeof APP_SETTING_KEYS)[keyof typeof APP_SETTING_KEYS];

export const APP_SETTING_KEY_LIST = Object.values(APP_SETTING_KEYS) as AppSettingKey[];
