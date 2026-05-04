import { z } from "zod";
import type {
  MarketBillingPolicyRow,
  MarketBillingProvider,
  MarketListingEntitlementRow,
  MarketOneOffPriceRow,
  MarketPricingAuditLogRow,
  MarketPricingControlPlaneTier,
  MarketPricingPolicyState,
} from "@/lib/billing/market-pricing";

type MarketPricingDbClient = {
  from: (table: string) => {
    select: (query?: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message?: string } | null }>;
      };
    };
    update: (
      payload: Record<string, unknown>
    ) => {
      eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
    };
    insert: (
      payload: Record<string, unknown>
    ) => Promise<{ error: { message?: string } | null }>;
  };
};

export const MARKET_PRICING_PROVIDER_VALUES = ["stripe", "paystack", "flutterwave"] as const;
export const MARKET_PRICING_POLICY_STATE_VALUES = ["draft", "approved", "live", "disabled"] as const;
export const MARKET_PRICING_ONE_OFF_ROLE_VALUES = ["tenant", "landlord", "agent"] as const;
export const MARKET_PRICING_ONE_OFF_TIER_VALUES = [
  "free",
  "starter",
  "pro",
  "tenant_pro",
  "enterprise",
] as const;

const optionalDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .transform((value) => value ?? null);

const optionalNotesSchema = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length ? trimmed : null;
  });

export const marketBillingPolicyPatchSchema = z
  .object({
    policy_state: z.enum(MARKET_PRICING_POLICY_STATE_VALUES),
    rental_enabled: z.boolean(),
    sale_enabled: z.boolean(),
    shortlet_enabled: z.boolean(),
    payg_listing_enabled: z.boolean(),
    featured_listing_enabled: z.boolean(),
    subscription_checkout_enabled: z.boolean(),
    listing_payg_provider: z.enum(MARKET_PRICING_PROVIDER_VALUES).nullable(),
    featured_listing_provider: z.enum(MARKET_PRICING_PROVIDER_VALUES).nullable(),
    operator_notes: optionalNotesSchema,
    effective_from: optionalDateTimeSchema,
    active: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.payg_listing_enabled && !value.listing_payg_provider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["listing_payg_provider"],
        message: "Listing PAYG provider is required when PAYG listing is enabled.",
      });
    }
    if (value.featured_listing_enabled && !value.featured_listing_provider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["featured_listing_provider"],
        message: "Featured listing provider is required when featured listing is enabled.",
      });
    }
  });

export const marketOneOffPricePatchSchema = z
  .object({
    amount_minor: z.number().int().min(0),
    provider: z.enum(MARKET_PRICING_PROVIDER_VALUES),
    role: z.enum(MARKET_PRICING_ONE_OFF_ROLE_VALUES).nullable(),
    tier: z.enum(MARKET_PRICING_ONE_OFF_TIER_VALUES).nullable(),
    enabled: z.boolean(),
    operator_notes: optionalNotesSchema,
    effective_from: optionalDateTimeSchema,
    active: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.role && value.tier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tier"],
        message: "Tier cannot be set without a role.",
      });
      return;
    }
    if (!value.role) return;

    const allowedTiers: Record<(typeof MARKET_PRICING_ONE_OFF_ROLE_VALUES)[number], readonly MarketPricingControlPlaneTier[]> = {
      tenant: ["free", "tenant_pro"],
      landlord: ["free", "starter", "pro"],
      agent: ["free", "starter", "pro", "enterprise"],
    };

    if (value.tier && !allowedTiers[value.role].includes(value.tier)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tier"],
        message: `Tier ${value.tier} is not valid for role ${value.role}.`,
      });
    }
  });

export const marketListingEntitlementPatchSchema = z.object({
  active_listing_limit: z.number().int().min(0),
  listing_credits: z.number().int().min(0),
  featured_credits: z.number().int().min(0),
  client_page_limit: z.number().int().min(0).nullable(),
  payg_beyond_cap_enabled: z.boolean(),
  operator_notes: optionalNotesSchema,
  effective_from: optionalDateTimeSchema,
  active: z.boolean(),
});

type ActionResult<T> =
  | { ok: true; row: T }
  | { ok: false; status: number; error: string };

const CANADA_LIVE_BLOCK_MESSAGE =
  "Canada runtime activation is deferred until the Canada PAYG pilot policy is approved and runtime integration is shipped.";

function stringifyError(error: { message?: string } | null | undefined, fallback: string) {
  return error?.message?.trim() || fallback;
}

async function loadRow<T extends Record<string, unknown>>(
  client: MarketPricingDbClient,
  table: string,
  id: string
): Promise<T | null> {
  const result = await client.from(table).select("*").eq("id", id).maybeSingle();
  return (result.data as T | null) ?? null;
}

async function insertAuditRow(
  client: MarketPricingDbClient,
  input: Omit<MarketPricingAuditLogRow, "id" | "created_at">
) {
  return client.from("market_pricing_audit_log").insert(input);
}

async function revertRow(
  client: MarketPricingDbClient,
  table: string,
  id: string,
  previous: Record<string, unknown>
) {
  const revertPayload = { ...previous };
  delete revertPayload.id;
  delete revertPayload.created_at;
  return client.from(table).update(revertPayload).eq("id", id);
}

async function updateWithAudit<T extends Record<string, unknown>>(input: {
  client: MarketPricingDbClient;
  table: string;
  entityType: MarketPricingAuditLogRow["entity_type"];
  entityId: string;
  actorId: string;
  payload: Record<string, unknown>;
  eventType: string;
}): Promise<ActionResult<T>> {
  const previous = await loadRow<T>(input.client, input.table, input.entityId);
  if (!previous) return { ok: false, status: 404, error: "Row not found." };

  const updateResult = await input.client
    .from(input.table)
    .update({
      ...input.payload,
      updated_by: input.actorId,
    })
    .eq("id", input.entityId);

  if (updateResult.error) {
    return {
      ok: false,
      status: 400,
      error: stringifyError(updateResult.error, "Unable to update row."),
    };
  }

  const next = await loadRow<T>(input.client, input.table, input.entityId);
  if (!next) {
    await revertRow(input.client, input.table, input.entityId, previous);
    return { ok: false, status: 500, error: "Updated row could not be reloaded." };
  }

  const auditResult = await insertAuditRow(input.client, {
    entity_type: input.entityType,
    entity_id: input.entityId,
    market_country: typeof next.market_country === "string" ? next.market_country : null,
    event_type: input.eventType,
    actor_id: input.actorId,
    previous_snapshot: previous,
    next_snapshot: next,
  });

  if (auditResult.error) {
    await revertRow(input.client, input.table, input.entityId, previous);
    return {
      ok: false,
      status: 500,
      error: "Update reverted because audit logging failed.",
    };
  }

  return { ok: true, row: next };
}

export function validateCanadaPolicyLiveGuard(row: Pick<MarketBillingPolicyRow, "market_country" | "currency">, next: {
  policy_state: MarketPricingPolicyState;
}) {
  if (row.market_country !== "CA") return null;
  if (next.policy_state !== "live") return null;
  if (row.currency !== "CAD") {
    return "Canada policy rows must remain CAD-backed before any live activation can be considered.";
  }
  return CANADA_LIVE_BLOCK_MESSAGE;
}

export async function updateMarketBillingPolicy(input: {
  client: MarketPricingDbClient;
  actorId: string;
  id: string;
  payload: unknown;
}): Promise<ActionResult<MarketBillingPolicyRow>> {
  const parsed = marketBillingPolicyPatchSchema.safeParse(input.payload);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.issues[0]?.message || "Invalid payload." };
  }

  const existing = await loadRow<MarketBillingPolicyRow>(input.client, "market_billing_policies", input.id);
  if (!existing) return { ok: false, status: 404, error: "Policy row not found." };

  const canadaGuardError = validateCanadaPolicyLiveGuard(existing, parsed.data);
  if (canadaGuardError) {
    return { ok: false, status: 409, error: canadaGuardError };
  }

  return updateWithAudit<MarketBillingPolicyRow>({
    client: input.client,
    table: "market_billing_policies",
    entityType: "market_billing_policy",
    entityId: input.id,
    actorId: input.actorId,
    payload: parsed.data,
    eventType: "updated",
  });
}

export async function updateMarketOneOffPrice(input: {
  client: MarketPricingDbClient;
  actorId: string;
  id: string;
  payload: unknown;
}): Promise<ActionResult<MarketOneOffPriceRow>> {
  const parsed = marketOneOffPricePatchSchema.safeParse(input.payload);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.issues[0]?.message || "Invalid payload." };
  }

  return updateWithAudit<MarketOneOffPriceRow>({
    client: input.client,
    table: "market_one_off_price_book",
    entityType: "market_one_off_price",
    entityId: input.id,
    actorId: input.actorId,
    payload: parsed.data,
    eventType: "updated",
  });
}

export async function updateMarketListingEntitlement(input: {
  client: MarketPricingDbClient;
  actorId: string;
  id: string;
  payload: unknown;
}): Promise<ActionResult<MarketListingEntitlementRow>> {
  const parsed = marketListingEntitlementPatchSchema.safeParse(input.payload);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.issues[0]?.message || "Invalid payload." };
  }

  return updateWithAudit<MarketListingEntitlementRow>({
    client: input.client,
    table: "market_listing_entitlements",
    entityType: "market_listing_entitlement",
    entityId: input.id,
    actorId: input.actorId,
    payload: parsed.data,
    eventType: "updated",
  });
}

export function getCanadaLiveBlockMessage() {
  return CANADA_LIVE_BLOCK_MESSAGE;
}

export type {
  MarketPricingDbClient,
  ActionResult,
  MarketBillingProvider,
};
