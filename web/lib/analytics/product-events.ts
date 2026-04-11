import { z } from "zod";

export const PRODUCT_ANALYTICS_EVENT_NAMES = [
  "search_performed",
  "filter_applied",
  "result_clicked",
  "listing_viewed",
  "listing_save_clicked",
  "listing_unsave_clicked",
  "shortlist_created",
  "shortlist_shared",
  "property_request_started",
  "property_request_published",
  "contact_submitted",
  "viewing_request_submitted",
  "billing_page_viewed",
  "plan_selected",
  "checkout_started",
  "checkout_succeeded",
  "listing_created",
  "listing_submitted_for_review",
  "listing_published_live",
  "qr_generated",
  "sign_kit_downloaded",
  "qr_redirect_succeeded",
  "qr_redirect_inactive_listing",
  "service_entrypoint_viewed",
  "service_request_started",
  "service_request_submitted",
  "service_request_matched",
  "service_request_unmatched",
  "provider_lead_sent",
  "provider_lead_accepted",
  "provider_lead_declined",
  "provider_response_submitted",
] as const;

export type ProductAnalyticsEventName = (typeof PRODUCT_ANALYTICS_EVENT_NAMES)[number];

export const PRODUCT_ANALYTICS_EVENT_FAMILY_BY_NAME: Record<
  ProductAnalyticsEventName,
  | "search_browse"
  | "listing_engagement"
  | "tenant_intent"
  | "billing"
  | "host_activation"
  | "move_ready_services"
> = {
  search_performed: "search_browse",
  filter_applied: "search_browse",
  result_clicked: "search_browse",
  listing_viewed: "listing_engagement",
  listing_save_clicked: "listing_engagement",
  listing_unsave_clicked: "listing_engagement",
  shortlist_created: "listing_engagement",
  shortlist_shared: "listing_engagement",
  property_request_started: "tenant_intent",
  property_request_published: "tenant_intent",
  contact_submitted: "tenant_intent",
  viewing_request_submitted: "tenant_intent",
  billing_page_viewed: "billing",
  plan_selected: "billing",
  checkout_started: "billing",
  checkout_succeeded: "billing",
  listing_created: "host_activation",
  listing_submitted_for_review: "host_activation",
  listing_published_live: "host_activation",
  qr_generated: "host_activation",
  sign_kit_downloaded: "host_activation",
  qr_redirect_succeeded: "listing_engagement",
  qr_redirect_inactive_listing: "listing_engagement",
  service_entrypoint_viewed: "move_ready_services",
  service_request_started: "move_ready_services",
  service_request_submitted: "move_ready_services",
  service_request_matched: "move_ready_services",
  service_request_unmatched: "move_ready_services",
  provider_lead_sent: "move_ready_services",
  provider_lead_accepted: "move_ready_services",
  provider_lead_declined: "move_ready_services",
  provider_response_submitted: "move_ready_services",
};

const eventNameSchema = z.enum(PRODUCT_ANALYTICS_EVENT_NAMES);

export const productAnalyticsPropertiesSchema = z
  .object({
    pagePath: z.string().trim().min(1).max(500).optional(),
    market: z.string().trim().min(2).max(16).optional(),
    role: z.string().trim().min(2).max(32).optional(),
    intent: z.string().trim().min(2).max(32).optional(),
    city: z.string().trim().min(1).max(120).optional().nullable(),
    area: z.string().trim().min(1).max(120).optional().nullable(),
    propertyType: z.string().trim().min(1).max(80).optional().nullable(),
    listingId: z.string().uuid().optional(),
    listingStatus: z.string().trim().min(1).max(80).optional().nullable(),
    planTier: z.string().trim().min(1).max(80).optional().nullable(),
    cadence: z.enum(["monthly", "yearly"]).optional(),
    billingSource: z.string().trim().min(1).max(80).optional().nullable(),
    currency: z.string().trim().min(2).max(8).optional().nullable(),
    amount: z.number().finite().nonnegative().max(100_000_000).optional(),
    resultsCount: z.number().int().nonnegative().max(1_000_000).optional(),
    filterCount: z.number().int().nonnegative().max(100).optional(),
    searchSource: z.string().trim().min(1).max(80).optional().nullable(),
    shareChannel: z.string().trim().min(1).max(80).optional().nullable(),
    provider: z.string().trim().min(1).max(40).optional().nullable(),
    providerSubscriptionId: z.string().trim().min(1).max(255).optional().nullable(),
    sourceEventId: z.string().trim().min(1).max(255).optional().nullable(),
    requestStatus: z.string().trim().min(1).max(80).optional().nullable(),
    requesterRole: z.string().trim().min(2).max(32).optional().nullable(),
    category: z.string().trim().min(1).max(80).optional().nullable(),
    propertyId: z.string().uuid().optional(),
    entrypointSource: z.string().trim().min(1).max(80).optional().nullable(),
    matchedProviderCount: z.number().int().nonnegative().max(100).optional(),
    providerId: z.string().uuid().optional(),
  });

export type ProductAnalyticsEventProperties = z.infer<typeof productAnalyticsPropertiesSchema>;

export const productAnalyticsClientPayloadSchema = z
  .object({
    eventName: eventNameSchema,
    properties: productAnalyticsPropertiesSchema.optional(),
  })
  .strict();

export type ProductAnalyticsClientPayload = z.infer<typeof productAnalyticsClientPayloadSchema>;

export function normalizeProductAnalyticsProperties(
  input: ProductAnalyticsEventProperties | Record<string, unknown> | null | undefined
): ProductAnalyticsEventProperties {
  const parsed = productAnalyticsPropertiesSchema.safeParse(input ?? {});
  return parsed.success ? parsed.data : {};
}

export function getProductAnalyticsEventFamily(eventName: ProductAnalyticsEventName) {
  return PRODUCT_ANALYTICS_EVENT_FAMILY_BY_NAME[eventName];
}
