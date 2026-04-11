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

type SubscriptionPriceBookAuditLogQuery = {
  marketCountry?: string;
  role?: SubscriptionPriceBookAuditLogRow["role"];
  cadence?: SubscriptionPriceBookAuditLogRow["cadence"];
  eventType?: SubscriptionPriceBookAuditLogRow["event_type"];
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};

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
  const result = await loadSubscriptionPriceBookAuditLogPage({ limit });
  return result.rows;
}

export async function loadSubscriptionPriceBookAuditLogPage(input: SubscriptionPriceBookAuditLogQuery = {}) {
  const client = await createPriceBookClient();
  if (!client) {
    return {
      rows: [] as SubscriptionPriceBookAuditLogRow[],
      count: 0,
    };
  }

  let query = client
    .from("subscription_price_book_audit_log")
    .select(SUBSCRIPTION_PRICE_BOOK_AUDIT_SELECT, { count: "exact" })
    .order("created_at", { ascending: false });

  if (input.marketCountry) query = query.eq("market_country", input.marketCountry);
  if (input.role) query = query.eq("role", input.role);
  if (input.cadence) query = query.eq("cadence", input.cadence);
  if (input.eventType) query = query.eq("event_type", input.eventType);
  if (input.actorId) query = query.eq("actor_id", input.actorId);
  if (input.dateFrom) query = query.gte("created_at", `${input.dateFrom}T00:00:00.000Z`);
  if (input.dateTo) query = query.lte("created_at", `${input.dateTo}T23:59:59.999Z`);

  if (typeof input.offset === "number" && typeof input.limit === "number") {
    query = query.range(input.offset, input.offset + input.limit - 1);
  } else if (typeof input.limit === "number") {
    query = query.limit(input.limit);
  }

  const { data, count } = await query;

  return {
    rows: ((data ?? []) as SubscriptionPriceBookAuditLogRow[]).filter(Boolean),
    count: count ?? 0,
  };
}
