import { getContactExchangeMode } from "@/lib/settings/app-settings.server";
import {
  CONTACT_EXCHANGE_BLOCK_CODE,
  CONTACT_EXCHANGE_BLOCK_MESSAGE,
  sanitizeMessageContent,
} from "@/lib/messaging/contact-exchange";
import { withDeliveryState } from "@/lib/messaging/status";
import { logFailure } from "@/lib/observability";
import type { UserRole } from "@/lib/types";
import type { LeadFinancing, LeadIntent, LeadTimeline } from "@/lib/leads/types";
import {
  buildLeadInsertPayload,
  resolveLeadIntent,
  validateLeadProperty,
  type LeadPropertyInput,
} from "@/lib/leads/lead-create";
import { buildLeadSystemMessage } from "@/lib/leads/lead-schema";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

type LeadCreateResult =
  | {
      ok: true;
      lead: Record<string, unknown>;
      threadId: string;
      message: Record<string, unknown> | null;
      leadIntent: LeadIntent;
    }
  | {
      ok: false;
      status: number;
      error: string;
      code?: string;
    };

type LeadCreateInput = {
  supabase: SupabaseClient;
  property: LeadPropertyInput | null;
  buyerId: string;
  buyerRole: UserRole;
  message: string;
  intent?: LeadIntent | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  financingStatus?: LeadFinancing | null;
  timeline?: LeadTimeline | null;
  allowListingIntent?: "buy" | "any";
  request: Request;
  route: string;
  startTime: number;
};

export async function createLeadThreadAndMessage(input: LeadCreateInput): Promise<LeadCreateResult> {
  const validation = validateLeadProperty(input.property, {
    allowListingIntent: input.allowListingIntent ?? "buy",
  });
  if (!validation.ok) {
    return validation;
  }

  const property = input.property as LeadPropertyInput;
  const contactMode = await getContactExchangeMode(input.supabase);
  const sanitized = sanitizeMessageContent(input.message, contactMode);

  if (sanitized.action === "block") {
    return {
      ok: false,
      status: 400,
      error: CONTACT_EXCHANGE_BLOCK_MESSAGE,
      code: CONTACT_EXCHANGE_BLOCK_CODE,
    };
  }

  const now = new Date().toISOString();
  const { data: threadRow, error: threadError } = await input.supabase
    .from("message_threads")
    .upsert(
      {
        property_id: property.id,
        tenant_id: input.buyerId,
        host_id: property.owner_id,
        subject: property.title ?? null,
        last_post_at: now,
      },
      { onConflict: "property_id,tenant_id,host_id" }
    )
    .select("id")
    .single();

  if (threadError || !threadRow) {
    return {
      ok: false,
      status: 400,
      error: threadError?.message || "Unable to create thread",
    };
  }

  const leadIntent = resolveLeadIntent({
    listingIntent: property.listing_intent,
    requestedIntent: input.intent ?? null,
  });

  const leadPayload = buildLeadInsertPayload({
    property,
    buyerId: input.buyerId,
    threadId: threadRow.id,
    intent: leadIntent,
    budgetMin: input.budgetMin ?? null,
    budgetMax: input.budgetMax ?? null,
    financingStatus: input.financingStatus ?? null,
    timeline: input.timeline ?? null,
    message: sanitized.text,
    messageOriginal: contactMode === "off" ? input.message : null,
    contactExchangeFlags: sanitized.meta ? { moderation: sanitized.meta } : null,
    now,
  });

  const { data: lead, error: leadError } = await input.supabase
    .from("listing_leads")
    .insert(leadPayload)
    .select()
    .single();

  if (leadError || !lead) {
    return {
      ok: false,
      status: 400,
      error: leadError?.message || "Unable to save enquiry",
    };
  }

  const systemMessage = buildLeadSystemMessage(sanitized.text, property.listing_intent);
  const { data: posted, error: postError } = await input.supabase
    .from("messages")
    .insert({
      thread_id: threadRow.id,
      property_id: property.id,
      sender_id: input.buyerId,
      recipient_id: property.owner_id,
      body: systemMessage,
      sender_role: input.buyerRole,
      metadata: {
        lead_id: lead.id,
        moderation: sanitized.meta ?? undefined,
      },
    })
    .select()
    .single();

  if (postError) {
    logFailure({
      request: input.request,
      route: input.route,
      status: 400,
      startTime: input.startTime,
      error: new Error(postError.message),
    });
  } else {
    await input.supabase
      .from("message_threads")
      .update({ last_post_at: now })
      .eq("id", threadRow.id);
  }

  return {
    ok: true,
    lead: lead as Record<string, unknown>,
    threadId: threadRow.id,
    message: posted ? withDeliveryState(posted as Record<string, unknown>) : null,
    leadIntent,
  };
}
