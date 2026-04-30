import { z } from "zod";

export const MOVE_READY_SERVICE_CATEGORIES = [
  "end_of_tenancy_cleaning",
  "fumigation_pest_control",
  "minor_repairs_handyman",
] as const;

export type MoveReadyServiceCategory = (typeof MOVE_READY_SERVICE_CATEGORIES)[number];

export const MOVE_READY_SERVICE_CATEGORY_LABELS: Record<MoveReadyServiceCategory, string> = {
  end_of_tenancy_cleaning: "End-of-tenancy cleaning",
  fumigation_pest_control: "Fumigation / pest control",
  minor_repairs_handyman: "Minor repairs / handyman",
};

export const MOVE_READY_SERVICE_CATEGORY_DESCRIPTIONS: Record<MoveReadyServiceCategory, string> = {
  end_of_tenancy_cleaning: "For relists, check-outs, and guest-ready turnovers.",
  fumigation_pest_control: "For infestations, preventative treatment, and property resets.",
  minor_repairs_handyman: "For quick fixes that unblock relisting or the next guest stay.",
};

export const MOVE_READY_PROVIDER_VERIFICATION_STATES = ["pending", "approved", "rejected"] as const;
export type MoveReadyProviderVerificationState =
  (typeof MOVE_READY_PROVIDER_VERIFICATION_STATES)[number];

export const MOVE_READY_PROVIDER_STATUSES = ["active", "paused"] as const;
export type MoveReadyProviderStatus = (typeof MOVE_READY_PROVIDER_STATUSES)[number];

export const MOVE_READY_PROVIDER_APPLICATION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "suspended",
] as const;
export type MoveReadyProviderApplicationStatus =
  (typeof MOVE_READY_PROVIDER_APPLICATION_STATUSES)[number];

export const MOVE_READY_REQUEST_STATUSES = ["submitted", "matched", "unmatched", "closed"] as const;
export type MoveReadyRequestStatus = (typeof MOVE_READY_REQUEST_STATUSES)[number];

export const MOVE_READY_LEAD_STATUSES = [
  "pending_delivery",
  "sent",
  "delivery_failed",
  "accepted",
  "declined",
] as const;
export type MoveReadyLeadStatus = (typeof MOVE_READY_LEAD_STATUSES)[number];

export const MOVE_READY_CONTACT_PREFERENCES = ["phone", "email"] as const;
export type MoveReadyContactPreference = (typeof MOVE_READY_CONTACT_PREFERENCES)[number];

export const MOVE_READY_ENTRYPOINT_SOURCES = ["host_overview", "host_listings"] as const;
export type MoveReadyEntrypointSource = (typeof MOVE_READY_ENTRYPOINT_SOURCES)[number];

export const MOVE_READY_MAX_PROVIDER_MATCHES = 3;

export const moveReadyServiceCategorySchema = z.enum(MOVE_READY_SERVICE_CATEGORIES);
export const moveReadyProviderVerificationStateSchema = z.enum(MOVE_READY_PROVIDER_VERIFICATION_STATES);
export const moveReadyProviderStatusSchema = z.enum(MOVE_READY_PROVIDER_STATUSES);
export const moveReadyProviderApplicationStatusSchema = z.enum(
  MOVE_READY_PROVIDER_APPLICATION_STATUSES
);
export const moveReadyRequestStatusSchema = z.enum(MOVE_READY_REQUEST_STATUSES);
export const moveReadyLeadStatusSchema = z.enum(MOVE_READY_LEAD_STATUSES);
export const moveReadyContactPreferenceSchema = z.enum(MOVE_READY_CONTACT_PREFERENCES);
export const moveReadyEntrypointSourceSchema = z.enum(MOVE_READY_ENTRYPOINT_SOURCES);

export const moveReadyProviderAreaSchema = z.object({
  marketCode: z.string().trim().min(2).max(16),
  city: z.string().trim().min(1).max(120).nullable().optional(),
  area: z.string().trim().min(1).max(120).nullable().optional(),
});

export type MoveReadyProviderAreaInput = z.infer<typeof moveReadyProviderAreaSchema>;

export const moveReadyProviderUpsertSchema = z.object({
  businessName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(240),
  phone: z.string().trim().min(5).max(40).nullable().optional(),
  verificationState: moveReadyProviderVerificationStateSchema.default("pending"),
  providerStatus: moveReadyProviderStatusSchema.default("active"),
  categories: z.array(moveReadyServiceCategorySchema).min(1).max(MOVE_READY_SERVICE_CATEGORIES.length),
  serviceAreas: z.array(moveReadyProviderAreaSchema).min(1).max(12),
  verificationReference: z.string().trim().max(240).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type MoveReadyProviderUpsertInput = z.infer<typeof moveReadyProviderUpsertSchema>;

export const moveReadySupplierApplicationCreateSchema = z.object({
  businessName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(240),
  phone: z.string().trim().min(5).max(40).nullable().optional(),
  categories: z.array(moveReadyServiceCategorySchema).min(1).max(MOVE_READY_SERVICE_CATEGORIES.length),
  serviceAreas: z.array(moveReadyProviderAreaSchema).min(1).max(12),
  verificationReference: z.string().trim().max(240).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type MoveReadySupplierApplicationCreateInput = z.infer<
  typeof moveReadySupplierApplicationCreateSchema
>;

export const moveReadyRequestCreateSchema = z.object({
  category: moveReadyServiceCategorySchema,
  marketCode: z.string().trim().min(2).max(16),
  city: z.string().trim().min(1).max(120).nullable().optional(),
  area: z.string().trim().min(1).max(120).nullable().optional(),
  propertyId: z.string().uuid().nullable().optional(),
  contextNotes: z.string().trim().min(8).max(2000),
  preferredTimingText: z.string().trim().min(2).max(200).nullable().optional(),
  contactPreference: moveReadyContactPreferenceSchema.nullable().optional(),
  entrypointSource: moveReadyEntrypointSourceSchema,
});

export type MoveReadyRequestCreateInput = z.infer<typeof moveReadyRequestCreateSchema>;

export const moveReadyProviderLeadResponseSchema = z.object({
  token: z.string().trim().min(20).max(255),
  action: z.enum(["accept", "decline"]),
  responseNote: z.string().trim().max(2000).nullable().optional(),
});

export type MoveReadyProviderLeadResponseInput = z.infer<typeof moveReadyProviderLeadResponseSchema>;

export function getMoveReadyCategoryLabel(category: MoveReadyServiceCategory | string | null | undefined) {
  if (!category) return "Unknown category";
  return MOVE_READY_SERVICE_CATEGORY_LABELS[category as MoveReadyServiceCategory] ?? category;
}

export function getMoveReadyRequestStatusLabel(status: MoveReadyRequestStatus | string | null | undefined) {
  switch (status) {
    case "matched":
      return "Matched to providers";
    case "unmatched":
      return "Needs manual routing";
    case "closed":
      return "Closed";
    case "submitted":
    default:
      return "Submitted";
  }
}

export function getMoveReadyLeadStatusLabel(status: MoveReadyLeadStatus | string | null | undefined) {
  switch (status) {
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    case "delivery_failed":
      return "Delivery failed";
    case "sent":
      return "Sent";
    case "pending_delivery":
    default:
      return "Pending delivery";
  }
}

export function resolveMoveReadyProviderApplicationStatus(input: {
  verificationState: MoveReadyProviderVerificationState | string | null | undefined;
  providerStatus: MoveReadyProviderStatus | string | null | undefined;
}): MoveReadyProviderApplicationStatus {
  if (input.verificationState === "rejected") return "rejected";
  if (input.verificationState === "approved" && input.providerStatus === "paused") return "suspended";
  if (input.verificationState === "approved" && input.providerStatus === "active") return "approved";
  return "pending";
}

export function getMoveReadyProviderApplicationStatusLabel(
  status: MoveReadyProviderApplicationStatus | string | null | undefined
) {
  switch (status) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "suspended":
      return "Suspended";
    case "pending":
    default:
      return "Pending review";
  }
}

export function parseMoveReadyAreaLines(input: string): MoveReadyProviderAreaInput[] {
  return input
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [marketCodeRaw, cityRaw, areaRaw] = line.split("|").map((part) => part?.trim() ?? "");
      return {
        marketCode: marketCodeRaw,
        city: cityRaw || null,
        area: areaRaw || null,
      };
    })
    .filter((item) => item.marketCode);
}

export function formatMoveReadyAreaLine(area: {
  marketCode?: string | null;
  city?: string | null;
  area?: string | null;
}) {
  const parts = [area.marketCode, area.city, area.area].filter(
    (value) => value && String(value).trim().length > 0
  );
  return parts.join(" • ");
}
