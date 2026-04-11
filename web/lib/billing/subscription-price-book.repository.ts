import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type {
  SubscriptionPriceBookAuditLogRow,
  SubscriptionPriceBookRow,
} from "@/lib/billing/subscription-price-book";

export const SUBSCRIPTION_PRICE_BOOK_SELECT =
  "id,product_area,role,tier,cadence,market_country,currency,amount_minor,provider,provider_price_ref,active,fallback_eligible,effective_at,ends_at,display_order,badge,operator_notes,created_at,updated_at,updated_by,workflow_state,replaces_price_book_id";

const SUBSCRIPTION_PRICE_BOOK_AUDIT_SELECT =
  "id,price_book_id,market_country,role,tier,cadence,provider,event_type,actor_id,previous_snapshot,next_snapshot,created_at";

async function createPriceBookClient(): Promise<SupabaseClient | null> {
  if (hasServiceRoleEnv()) return createServiceRoleClient();
  if (hasServerSupabaseEnv()) return createServerSupabaseClient();
  return null;
}

export async function loadSubscriptionPriceBookRows() {
  const client = await createPriceBookClient();
  if (!client) return [] as SubscriptionPriceBookRow[];

  const { data } = await client
    .from("subscription_price_book")
    .select(SUBSCRIPTION_PRICE_BOOK_SELECT)
    .order("market_country", { ascending: true })
    .order("display_order", { ascending: true })
    .order("cadence", { ascending: true })
    .order("effective_at", { ascending: false });

  return ((data ?? []) as SubscriptionPriceBookRow[]).filter(Boolean);
}

export async function loadSubscriptionPriceBookRowsByProviderPriceRef(
  provider: SubscriptionPriceBookRow["provider"],
  providerPriceRef: string
) {
  const client = await createPriceBookClient();
  if (!client) return [] as SubscriptionPriceBookRow[];

  const { data } = await client
    .from("subscription_price_book")
    .select(SUBSCRIPTION_PRICE_BOOK_SELECT)
    .eq("provider", provider)
    .eq("provider_price_ref", providerPriceRef)
    .order("active", { ascending: false })
    .order("effective_at", { ascending: false })
    .order("updated_at", { ascending: false });

  return ((data ?? []) as SubscriptionPriceBookRow[]).filter(Boolean);
}

export async function loadSubscriptionPriceBookAuditLog(limit = 24) {
  const client = await createPriceBookClient();
  if (!client) return [] as SubscriptionPriceBookAuditLogRow[];

  const { data } = await client
    .from("subscription_price_book_audit_log")
    .select(SUBSCRIPTION_PRICE_BOOK_AUDIT_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as SubscriptionPriceBookAuditLogRow[]).filter(Boolean);
}
