import type { ReferralShareChannel } from "@/lib/referrals/share-tracking.server";

export type DefaultReferralCampaignTemplate = {
  name: string;
  channel: ReferralShareChannel;
  utm_source: string;
  landing_path: string;
};

export const DEFAULT_REFERRAL_CAMPAIGN_TEMPLATES: DefaultReferralCampaignTemplate[] = [
  {
    name: "WhatsApp",
    channel: "whatsapp",
    utm_source: "whatsapp",
    landing_path: "/get-started",
  },
  {
    name: "Instagram",
    channel: "other",
    utm_source: "instagram",
    landing_path: "/get-started",
  },
  {
    name: "Direct link",
    channel: "copy",
    utm_source: "direct",
    landing_path: "/get-started",
  },
];

function normalizeName(name: string) {
  return String(name || "").trim().toLowerCase();
}

export function computeMissingDefaultReferralCampaigns(
  existingCampaigns: Array<{ name: string }>
): DefaultReferralCampaignTemplate[] {
  const existing = new Set(existingCampaigns.map((row) => normalizeName(row.name)));
  return DEFAULT_REFERRAL_CAMPAIGN_TEMPLATES.filter((template) => !existing.has(normalizeName(template.name)));
}

