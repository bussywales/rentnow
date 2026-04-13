import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeLeadContactExchangeFlags } from "@/lib/leads/progression";

export type LeadProgressionEvent =
  | "enquiry_replied"
  | "viewing_requested"
  | "viewing_confirmed"
  | "contact_exchange_attempted";

type LeadRow = {
  id: string;
  status: string;
  contact_exchange_flags?: Record<string, unknown> | null;
};

function nextStatusForEvent(currentStatus: string, event: LeadProgressionEvent) {
  if (event === "enquiry_replied") {
    return currentStatus === "NEW" ? "CONTACTED" : currentStatus;
  }
  if (event === "viewing_requested") {
    if (currentStatus === "WON" || currentStatus === "LOST" || currentStatus === "CLOSED") {
      return currentStatus;
    }
    return "VIEWING";
  }
  return currentStatus;
}

export async function touchLeadProgression(input: {
  client: SupabaseClient;
  propertyId: string;
  buyerId: string;
  event: LeadProgressionEvent;
  occurredAt?: string;
  moderationMeta?: Record<string, unknown> | null;
}) {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const { data, error } = await input.client
    .from("listing_leads")
    .select("id, status, contact_exchange_flags")
    .eq("property_id", input.propertyId)
    .eq("buyer_id", input.buyerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { ok: false as const, error: error?.message ?? "lead_not_found" };
  }

  const lead = data as LeadRow;
  const patch: Record<string, unknown> = {
    updated_at: occurredAt,
  };

  const nextStatus = nextStatusForEvent(lead.status, input.event);
  if (nextStatus !== lead.status) {
    patch.status = nextStatus;
  }

  if (input.event === "enquiry_replied") {
    patch.replied_at = occurredAt;
  }
  if (input.event === "viewing_requested") {
    patch.viewing_requested_at = occurredAt;
  }
  if (input.event === "viewing_confirmed") {
    patch.viewing_confirmed_at = occurredAt;
  }
  if (input.event === "contact_exchange_attempted") {
    patch.off_platform_handoff_at = occurredAt;
    patch.contact_exchange_flags = mergeLeadContactExchangeFlags({
      existing: lead.contact_exchange_flags ?? null,
      moderationMeta: input.moderationMeta ?? null,
      occurredAt,
    });
  }

  const { error: updateError } = await input.client
    .from("listing_leads")
    .update(patch)
    .eq("id", lead.id);

  if (updateError) {
    return { ok: false as const, error: updateError.message };
  }

  return { ok: true as const, leadId: lead.id, nextStatus };
}
