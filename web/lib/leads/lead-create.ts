import type { ListingIntent } from "@/lib/types";
import type { LeadFinancing, LeadIntent, LeadTimeline } from "@/lib/leads/types";
import { isRentIntent, isSaleIntent } from "@/lib/listing-intents";

export type LeadPropertyInput = {
  id: string;
  owner_id: string;
  title?: string | null;
  is_approved?: boolean | null;
  is_active?: boolean | null;
  listing_intent?: ListingIntent | null;
};

export type LeadValidationResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export type LeadInsertInput = {
  property: LeadPropertyInput;
  buyerId: string;
  threadId: string;
  intent: LeadIntent;
  budgetMin?: number | null;
  budgetMax?: number | null;
  financingStatus?: LeadFinancing | null;
  timeline?: LeadTimeline | null;
  message: string;
  messageOriginal?: string | null;
  contactExchangeFlags?: Record<string, unknown> | null;
  now: string;
};

export function resolveLeadIntent(input: {
  listingIntent?: ListingIntent | null;
  requestedIntent?: LeadIntent | null;
}): LeadIntent {
  if (isRentIntent(input.listingIntent)) return "ASK_QUESTION";
  return input.requestedIntent ?? "BUY";
}

export function validateLeadProperty(
  property: LeadPropertyInput | null,
  options?: { allowListingIntent?: "buy" | "any" }
): LeadValidationResult {
  if (!property) {
    return { ok: false, status: 404, error: "Listing not found" };
  }

  if (property.is_approved === false || property.is_active === false) {
    return { ok: false, status: 403, error: "Listing is not available." };
  }

  if ((options?.allowListingIntent ?? "buy") === "buy") {
    if (!isSaleIntent(property.listing_intent)) {
      return {
        ok: false,
        status: 400,
        error: "Enquiries are only available for buy listings.",
      };
    }
  }

  return { ok: true };
}

export function buildLeadInsertPayload(input: LeadInsertInput) {
  return {
    property_id: input.property.id,
    owner_id: input.property.owner_id,
    buyer_id: input.buyerId,
    thread_id: input.threadId,
    status: "NEW",
    intent: input.intent,
    budget_min: input.budgetMin ?? null,
    budget_max: input.budgetMax ?? null,
    financing_status: input.financingStatus ?? null,
    timeline: input.timeline ?? null,
    message: input.message,
    message_original: input.messageOriginal ?? null,
    contact_exchange_flags: input.contactExchangeFlags ?? null,
    created_at: input.now,
    updated_at: input.now,
  };
}
