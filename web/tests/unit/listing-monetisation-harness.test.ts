import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import type Stripe from "stripe";
import type { User } from "@supabase/supabase-js";

import {
  postPropertySubmitResponse,
  type ListingSubmitDeps,
} from "@/app/api/properties/[id]/submit/route";
import {
  postPropertyRenewResponse,
  type RenewDeps,
} from "@/app/api/properties/[id]/renew/route";
import { postBillingWebhookResponse } from "@/app/api/billing/webhook/route";
import { postPaystackVerifyResponse } from "@/app/api/billing/paystack/verify/route";
import { postFlutterwaveVerifyResponse } from "@/app/api/billing/flutterwave/verify/route";
import { processStripeEvent } from "@/lib/billing/stripe-event-processor";
import { getListingAccessResult } from "@/lib/role-access";

const originalLandlordStarterMonthlyCadPriceEnv = process.env.STRIPE_PRICE_LANDLORD_STARTER_MONTHLY_CAD;

test.before(() => {
  process.env.STRIPE_PRICE_LANDLORD_STARTER_MONTHLY_CAD = "price_ca_starter_monthly";
});

test.after(() => {
  if (originalLandlordStarterMonthlyCadPriceEnv === undefined) {
    delete process.env.STRIPE_PRICE_LANDLORD_STARTER_MONTHLY_CAD;
    return;
  }

  process.env.STRIPE_PRICE_LANDLORD_STARTER_MONTHLY_CAD = originalLandlordStarterMonthlyCadPriceEnv;
});

/**
 * Listing monetisation contract proven by this harness:
 *
 * 1. Listing publish, renew, and reactivation are role-gated before plan logic.
 *    `tenant_pro` is a billing product, not a listing-management role unlock.
 * 2. Active listing limit is enforced before any listing credit is consumed.
 * 3. Under the active limit, submit and renew succeed when a listing credit exists.
 * 4. If no listing credit exists, PAYG-enabled flows return `PAYMENT_REQUIRED`.
 * 5. If no listing credit exists and PAYG is disabled, flows return `BILLING_REQUIRED`.
 * 6. One-off Paystack listing-payment webhooks create a listing credit, consume it idempotently,
 *    and move the listing back into the canonical pending-review state.
 * 7. Recurring provider callbacks restore publish entitlement by updating provider-owned plan state
 *    and issuing subscription listing credits before the next publish/renew attempt.
 *
 * Markets in current repo truth:
 * - Listing entitlement enforcement itself is market-agnostic today.
 * - Market differences mainly exist in provider/payment lanes, not in the publish/renew gate.
 * - The matrix below therefore uses NG / UK / CA scenario labels and provider metadata without
 *   inventing market-specific publish rules that do not yet exist in repo truth.
 */

type SubmitListingRow = {
  id: string;
  owner_id: string;
  status?: string | null;
  submitted_at?: string | null;
  status_updated_at?: string | null;
  listing_intent?: string | null;
  rental_type?: string | null;
  listing_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  location_place_id?: string | null;
  title?: string | null;
  city?: string | null;
  country_code?: string | null;
  is_active?: boolean | null;
  is_approved?: boolean | null;
};

type RenewPropertyRow = {
  id: string;
  owner_id: string;
  status: string;
  expires_at?: string | null;
};

type InMemoryState = Record<string, Record<string, unknown>[]>;

class InMemoryQuery<T extends Record<string, unknown>> {
  private filters: Array<{ column: string; value: string | number | boolean | null }> = [];
  private operation: "select" | "update" | "upsert" | "insert" = "select";
  private payload: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private onConflict: string | null = null;

  constructor(
    private readonly table: string,
    private readonly state: InMemoryState
  ) {}

  select() {
    return this;
  }

  update(values: Record<string, unknown>) {
    this.operation = "update";
    this.payload = values;
    return this;
  }

  upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) {
    this.operation = "upsert";
    this.payload = values;
    this.onConflict = options?.onConflict ?? null;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.operation = "insert";
    this.payload = values;
    return this;
  }

  eq(column: string, value: string | number | boolean | null) {
    this.filters.push({ column, value });
    return this;
  }

  async maybeSingle() {
    const result = await this.execute();
    if (Array.isArray(result.data)) {
      return {
        data: (result.data[0] as T | null) ?? null,
        error: result.error,
      };
    }
    return { data: (result.data as T | null) ?? null, error: result.error };
  }

  then<TResult1 = { data: T[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: T[]; error: null }> {
    const rows = (this.state[this.table] ??= []);

    if (this.operation === "select") {
      return { data: this.applyFilters(rows) as T[], error: null };
    }

    if (this.operation === "update") {
      const nextRows = this.applyFilters(rows);
      for (const row of nextRows) {
        Object.assign(row, this.payload ?? {});
      }
      return { data: nextRows as T[], error: null };
    }

    if (this.operation === "insert") {
      const inserted = this.normalizeRows(this.payload).map((row, index) => ({
        id: row.id ?? `${this.table}_${rows.length + index + 1}`,
        ...row,
      }));
      rows.push(...inserted);
      return { data: inserted as T[], error: null };
    }

    const upsertRows = this.normalizeRows(this.payload);
    const resultRows: Record<string, unknown>[] = [];
    for (const row of upsertRows) {
      const existing = this.findByConflict(rows, row);
      if (existing) {
        Object.assign(existing, row);
        resultRows.push(existing);
      } else {
        const created = { id: row.id ?? `${this.table}_${rows.length + resultRows.length + 1}`, ...row };
        rows.push(created);
        resultRows.push(created);
      }
    }
    return { data: resultRows as T[], error: null };
  }

  private applyFilters(rows: Record<string, unknown>[]) {
    return rows.filter((row) =>
      this.filters.every(({ column, value }) => (row[column] ?? null) === value)
    );
  }

  private normalizeRows(values: Record<string, unknown> | Record<string, unknown>[] | null) {
    if (!values) return [];
    return Array.isArray(values) ? values : [values];
  }

  private findByConflict(rows: Record<string, unknown>[], candidate: Record<string, unknown>) {
    const keys = (this.onConflict ?? "id").split(",").map((value) => value.trim());
    return rows.find((row) => keys.every((key) => (row[key] ?? null) === (candidate[key] ?? null))) ?? null;
  }
}

function createInMemoryAdminClient(state: InMemoryState) {
  return {
    from<T extends Record<string, unknown>>(table: string) {
      return new InMemoryQuery<T>(table, state);
    },
  };
}

function makeSubmitRequest(idempotencyKey = "idem-submit-12345") {
  return new NextRequest("http://localhost/api/properties/prop1/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idempotencyKey }),
  });
}

function makeRenewRequest() {
  return new NextRequest("http://localhost/api/properties/prop1/renew", { method: "POST" });
}

function buildSubmitSupabaseStub(
  listing: SubmitListingRow,
  options?: {
    activeCount?: number;
    planTier?: string;
    maxListingsOverride?: number | null;
    validUntil?: string | null;
    nightlyPriceMinor?: number | null;
    ownerRole?: string;
  }
) {
  let lastPropertyUpdate: Record<string, unknown> | null = null;
  const supabase = {
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        const selectOptions = args[1] as { count?: string; head?: boolean } | undefined;
        if (table === "properties" && selectOptions?.count === "exact" && selectOptions?.head) {
          const result = { count: options?.activeCount ?? 0, error: null };
          const builder = {
            eq() {
              return builder;
            },
            neq() {
              return builder;
            },
            then(resolve: (value: typeof result) => unknown) {
              return Promise.resolve(resolve(result));
            },
          };
          return builder;
        }
        return {
          eq: () => ({
            maybeSingle: async () => {
              if (table === "shortlet_settings") {
                return { data: { nightly_price_minor: options?.nightlyPriceMinor ?? null } };
              }
              if (table === "profile_plans") {
                return {
                  data: {
                    plan_tier: options?.planTier ?? "free",
                    max_listings_override: options?.maxListingsOverride ?? null,
                    valid_until: options?.validUntil ?? null,
                  },
                  error: null,
                };
              }
              if (table === "profiles") {
                return {
                  data: {
                    role: options?.ownerRole ?? "landlord",
                    display_name: "Owner",
                    full_name: "Owner Name",
                  },
                  error: null,
                };
              }
              return { data: listing, error: null };
            },
          }),
        };
      },
      update: (payload: Record<string, unknown>) => ({
        eq: async () => {
          if (table === "properties") {
            lastPropertyUpdate = payload;
          }
          return { error: null };
        },
      }),
    }),
    rpc: async () => ({ data: { inserted: true } }),
  };

  return {
    supabase,
    getLastPropertyUpdate: () => lastPropertyUpdate,
  };
}

function buildSubmitDeps(input: {
  supabase: ReturnType<ListingSubmitDeps["createServerSupabaseClient"]>;
  role: "landlord" | "agent" | "tenant" | "admin";
  paygEnabled?: boolean;
  paygCurrency?: string;
  paygAmount?: number;
  consumeListingCredit: ListingSubmitDeps["consumeListingCredit"];
  getListingAccessResult?: ListingSubmitDeps["getListingAccessResult"];
}) {
  return {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => input.supabase,
    createServiceRoleClient: () =>
      input.supabase as ReturnType<ListingSubmitDeps["createServiceRoleClient"]>,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase: input.supabase,
      }) as Awaited<ReturnType<ListingSubmitDeps["requireUser"]>>,
    getUserRole: async () => input.role,
    getListingAccessResult: input.getListingAccessResult ?? getListingAccessResult,
    hasActiveDelegation: async () => false,
    getPaygConfig: async () => ({
      enabled: input.paygEnabled ?? true,
      amount: input.paygAmount ?? 2000,
      currency: input.paygCurrency ?? "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: input.consumeListingCredit,
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    getAppSettingBool: async (key: string) => key === "listings_auto_approve_enabled" ? false : false,
    getListingExpiryDays: async () => 90,
    requireLegalAcceptance: async () => ({ ok: true }) as Awaited<ReturnType<ListingSubmitDeps["requireLegalAcceptance"]>>,
    logPropertyEvent: async () => ({ ok: true }),
    resolveEventSessionKey: () => null,
    logFailure: () => undefined,
    notifyAdminsOfListingReviewSubmission: async () => undefined,
  } satisfies ListingSubmitDeps;
}

function buildRenewSupabaseStub(
  property: RenewPropertyRow,
  capture: { updatePayload: Record<string, unknown> | null },
  options?: {
    activeCount?: number;
    planTier?: string;
    maxListingsOverride?: number | null;
    validUntil?: string | null;
  }
) {
  return {
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        const selectOptions = args[1] as { count?: string; head?: boolean } | undefined;
        if (table === "properties" && selectOptions?.count === "exact" && selectOptions?.head) {
          const result = { count: options?.activeCount ?? 0, error: null };
          const builder = {
            eq() {
              return builder;
            },
            neq() {
              return builder;
            },
            then(resolve: (value: typeof result) => unknown) {
              return Promise.resolve(resolve(result));
            },
          };
          return builder;
        }
        return {
          eq: () => ({
            maybeSingle: async () =>
              table === "properties"
                ? { data: property, error: null }
                : table === "profile_plans"
                  ? {
                      data: {
                        plan_tier: options?.planTier ?? "free",
                        max_listings_override: options?.maxListingsOverride ?? null,
                        valid_until: options?.validUntil ?? null,
                      },
                      error: null,
                    }
                  : { data: { role: "landlord" }, error: null },
          }),
        };
      },
      update: (payload: Record<string, unknown>) => ({
        eq: async () => {
          capture.updatePayload = payload;
          return { error: null };
        },
      }),
    }),
  } as ReturnType<RenewDeps["createServerSupabaseClient"]>;
}

function buildRenewDeps(input: {
  supabase: ReturnType<RenewDeps["createServerSupabaseClient"]>;
  role: "landlord" | "agent" | "admin";
  paygEnabled?: boolean;
  paygCurrency?: string;
  paygAmount?: number;
  consumeListingCredit: RenewDeps["consumeListingCredit"];
}) {
  return {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () => input.supabase,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase: input.supabase,
      }) as Awaited<ReturnType<RenewDeps["requireUser"]>>,
    getUserRole: async () => input.role,
    getListingAccessResult: getListingAccessResult,
    hasActiveDelegation: async () => false,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () =>
      input.supabase as ReturnType<RenewDeps["createServiceRoleClient"]>,
    getListingExpiryDays: async () => 90,
    getPaygConfig: async () => ({
      enabled: input.paygEnabled ?? true,
      amount: input.paygAmount ?? 2000,
      currency: input.paygCurrency ?? "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: input.consumeListingCredit,
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    logFailure: () => undefined,
  } satisfies RenewDeps;
}

void test("free landlord in NG can submit when one listing credit is available", async () => {
  const listing: SubmitListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
    country_code: "NG",
    listing_intent: "rent",
    rental_type: "flat",
  };
  const { supabase, getLastPropertyUpdate } = buildSubmitSupabaseStub(listing, {
    activeCount: 0,
    planTier: "free",
  });

  const response = await postPropertySubmitResponse(
    makeSubmitRequest("idem-ng-free-credit"),
    "prop1",
    buildSubmitDeps({
      supabase: supabase as ReturnType<ListingSubmitDeps["createServerSupabaseClient"]>,
      role: "landlord",
      consumeListingCredit: async () => ({
        ok: true,
        consumed: true,
        alreadyConsumed: false,
        source: "subscription",
        creditId: "credit-1",
        idempotencyKey: "idem-ng-free-credit",
      }),
    })
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.status, "pending");
  assert.ok(getLastPropertyUpdate());
});

void test("starter landlord in UK can submit under the active limit when subscription credits exist", async () => {
  const listing: SubmitListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
    country_code: "GB",
    listing_intent: "rent",
    rental_type: "flat",
  };
  const { supabase } = buildSubmitSupabaseStub(listing, {
    activeCount: 2,
    planTier: "starter",
  });

  const response = await postPropertySubmitResponse(
    makeSubmitRequest("idem-gb-starter-credit"),
    "prop1",
    buildSubmitDeps({
      supabase: supabase as ReturnType<ListingSubmitDeps["createServerSupabaseClient"]>,
      role: "landlord",
      consumeListingCredit: async () => ({
        ok: true,
        consumed: true,
        alreadyConsumed: false,
        source: "subscription",
        creditId: "credit-2",
        idempotencyKey: "idem-gb-starter-credit",
      }),
    })
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.status, "pending");
});

void test("pro agent in Canada can renew an expired listing when a listing credit exists", async () => {
  const capture = { updatePayload: null as Record<string, unknown> | null };
  const supabase = buildRenewSupabaseStub(
    {
      id: "prop1",
      owner_id: "owner",
      status: "expired",
      expires_at: "2026-04-01T00:00:00.000Z",
    },
    capture,
    {
      activeCount: 9,
      planTier: "pro",
    }
  );

  const response = await postPropertyRenewResponse(
    makeRenewRequest(),
    "prop1",
    buildRenewDeps({
      supabase,
      role: "agent",
      consumeListingCredit: async () => ({
        ok: true,
        consumed: true,
        alreadyConsumed: false,
        source: "subscription",
        creditId: "credit-3",
        idempotencyKey: "idem-ca-pro-renew",
      }),
    })
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.status, "live");
  assert.ok(capture.updatePayload);
});

void test("tenant_pro does not unlock listing publish for tenant-role accounts", async () => {
  const listing: SubmitListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
  };
  const { supabase } = buildSubmitSupabaseStub(listing, {
    activeCount: 0,
    planTier: "tenant_pro",
  });

  const response = await postPropertySubmitResponse(
    makeSubmitRequest("idem-tenant-blocked"),
    "prop1",
    buildSubmitDeps({
      supabase: supabase as ReturnType<ListingSubmitDeps["createServerSupabaseClient"]>,
      role: "tenant",
      consumeListingCredit: async () => ({
        ok: true,
        consumed: true,
        alreadyConsumed: false,
        source: "subscription",
        creditId: "credit-4",
        idempotencyKey: "idem-tenant-blocked",
      }),
    })
  );

  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.code, "role_not_allowed");
  assert.match(String(body.error ?? ""), /Tenants can't list properties/);
});

void test("starter plan limit blocks before any credit is consumed", async () => {
  const listing: SubmitListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
  };
  const { supabase } = buildSubmitSupabaseStub(listing, {
    activeCount: 3,
    planTier: "starter",
  });
  let creditAttempted = false;

  const response = await postPropertySubmitResponse(
    makeSubmitRequest("idem-limit-block"),
    "prop1",
    buildSubmitDeps({
      supabase: supabase as ReturnType<ListingSubmitDeps["createServerSupabaseClient"]>,
      role: "landlord",
      consumeListingCredit: async () => {
        creditAttempted = true;
        return {
          ok: true,
          consumed: true,
          alreadyConsumed: false,
          source: "subscription",
          creditId: "credit-5",
          idempotencyKey: "idem-limit-block",
        };
      },
    })
  );

  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.reason, "LISTING_LIMIT_REACHED");
  assert.equal(body.maxListings, 3);
  assert.equal(body.activeCount, 3);
  assert.equal(creditAttempted, false);
});

void test("submit returns BILLING_REQUIRED when no credits exist and PAYG is disabled", async () => {
  const listing: SubmitListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
  };
  const { supabase } = buildSubmitSupabaseStub(listing, {
    activeCount: 0,
    planTier: "free",
  });

  const response = await postPropertySubmitResponse(
    makeSubmitRequest("idem-billing-required"),
    "prop1",
    buildSubmitDeps({
      supabase: supabase as ReturnType<ListingSubmitDeps["createServerSupabaseClient"]>,
      role: "landlord",
      paygEnabled: false,
      consumeListingCredit: async () => ({ ok: false, reason: "NO_CREDITS" }),
    })
  );

  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.reason, "BILLING_REQUIRED");
  assert.equal(body.billingUrl, "/dashboard/billing#plans");
  assert.match(String(body.resumeUrl ?? ""), /monetization=billing_required/);
});

void test("renew returns PAYMENT_REQUIRED when no credits exist and PAYG is enabled", async () => {
  const capture = { updatePayload: null as Record<string, unknown> | null };
  const supabase = buildRenewSupabaseStub(
    {
      id: "prop1",
      owner_id: "owner",
      status: "expired",
      expires_at: "2026-04-01T00:00:00.000Z",
    },
    capture,
    {
      activeCount: 0,
      planTier: "free",
    }
  );

  const response = await postPropertyRenewResponse(
    makeRenewRequest(),
    "prop1",
    buildRenewDeps({
      supabase,
      role: "landlord",
      paygEnabled: true,
      consumeListingCredit: async () => ({ ok: false, reason: "NO_CREDITS" }),
    })
  );

  assert.equal(response.status, 402);
  const body = await response.json();
  assert.equal(body.reason, "PAYMENT_REQUIRED");
  assert.equal(body.billingUrl, "/dashboard/billing#plans");
  assert.match(String(body.resumeUrl ?? ""), /monetization_context=renewal/);
  assert.equal(capture.updatePayload, null);
});

void test("paystack listing-payment webhook restores a purchased listing into pending review", async () => {
  const state: InMemoryState = {
    listing_payments: [
      {
        id: "pay_1",
        user_id: "owner-1",
        listing_id: "listing-1",
        status: "pending",
        amount: 2000,
        currency: "NGN",
        provider: "paystack",
        provider_ref: "ps_ref_listing_12345",
        idempotency_key: "idem-payg-listing-1",
      },
    ],
    feature_purchases: [],
    listing_credit_consumptions: [],
    listing_credits: [],
    properties: [
      {
        id: "listing-1",
        status: "draft",
        is_active: false,
        is_approved: false,
      },
    ],
  };
  const adminClient = createInMemoryAdminClient(state);
  let consumedInput: { userId: string; listingId: string; idempotencyKey: string } | null = null;
  const rawBody = JSON.stringify({
    event: "charge.success",
    data: {
      reference: "ps_ref_listing_12345",
    },
  });
  const signature = crypto.createHmac("sha512", "paystack_wh_test").update(rawBody).digest("hex");

  const response = await postBillingWebhookResponse(
    new Request("http://localhost/api/billing/webhook", {
      method: "POST",
      headers: {
        "x-paystack-signature": signature,
        "content-type": "application/json",
      },
      body: rawBody,
    }),
    {
      hasServiceRoleEnv: () => true,
      getProviderModes: async () => ({ paystackMode: "test" }),
      getPaystackServerConfig: async () => ({
        mode: "test",
        secretKey: "sk_test_paystack",
        publicKey: "pk_test_paystack",
        webhookSecret: "paystack_wh_test",
        keyPresent: true,
        source: "env",
        webhookSource: "env",
        fallbackFromLive: false,
      }),
      createServiceRoleClient: () => adminClient as never,
      getPaystackSubscriptionEventByReference: async () => null,
      finalizePaystackSubscriptionEvent: async () => ({
        status: "failed",
        retryable: false,
        httpStatus: 500,
        reason: "not_used",
        validUntil: null,
        profileId: null,
        planTier: null,
        mode: "test",
      }) as never,
      consumeListingCredit: async ({ userId, listingId, idempotencyKey }) => {
        consumedInput = { userId, listingId, idempotencyKey };
        return {
          ok: true,
          consumed: true,
          alreadyConsumed: false,
          source: "payg",
          creditId: "credit-1",
          idempotencyKey,
        };
      },
      consumeFeaturedCredit: async () => ({ ok: true, consumed: true, source: "payg", creditId: "feat-1", idempotencyKey: "unused" }),
      getFeaturedConfig: async () => ({ paygAmount: 5000, currency: "NGN", durationDays: 30 }),
      logFailure: () => undefined,
      logPropertyEvent: async () => undefined,
      issueReferralRewardsForEvent: async () => undefined,
    }
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.deepEqual(consumedInput, {
    userId: "owner-1",
    listingId: "listing-1",
    idempotencyKey: "idem-payg-listing-1",
  });
  assert.equal(state.listing_payments[0]?.status, "paid");
  assert.equal(state.listing_credits.length, 1);
  assert.equal(state.properties[0]?.status, "pending");
  assert.equal(state.properties[0]?.is_active, true);
});

void test("paystack subscription verify route returns verified for an allowed NG starter callback", async () => {
  const response = await postPaystackVerifyResponse(
    new Request("http://localhost/api/billing/paystack/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference: "ps_sub_ref_12345" }),
    }),
    {
      requireRole: async () =>
        ({
          ok: true,
          role: "landlord",
          user: { id: "landlord-1" } as User,
          supabase: {} as never,
        }) as never,
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => createInMemoryAdminClient({}) as never,
      getPaystackSubscriptionEventByReference: async () => ({
        id: "evt_1",
        profile_id: "landlord-1",
        plan_tier: "starter",
      }) as never,
      finalizePaystackSubscriptionEvent: async () => ({
        status: "verified",
        retryable: false,
        httpStatus: 200,
        reason: null,
        validUntil: "2026-06-01T00:00:00.000Z",
        profileId: "landlord-1",
        planTier: "starter",
        mode: "test",
      }) as never,
      resolveTierForRole: () => "starter",
      logProviderPlanUpdated: () => undefined,
      logProviderVerifyOutcome: () => undefined,
      logFailure: () => undefined,
    }
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.status, "verified");
  assert.equal(payload.valid_until, "2026-06-01T00:00:00.000Z");
});

void test("flutterwave verify route updates provider-owned plan state and requests subscription credits", async () => {
  const state: InMemoryState = {
    provider_payment_events: [
      {
        id: "evt_fw_1",
        provider: "flutterwave",
        reference: "fw_ref_12345",
        profile_id: "agent-1",
        plan_tier: "pro",
        cadence: "monthly",
        status: "initialized",
        processed_at: null,
        mode: "test",
        amount: 4900,
        currency: "NGN",
        transaction_id: null,
      },
    ],
    profile_plans: [],
  };
  const adminClient = createInMemoryAdminClient(state);
  let issuedCreditsFor: { subscriptionId: string; userId: string; planTier: string | null } | null = null;

  const response = await postFlutterwaveVerifyResponse(
    new Request("http://localhost/api/billing/flutterwave/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tx_ref: "fw_ref_12345", transaction_id: "tx_123" }),
    }),
    {
      requireRole: async () =>
        ({
          ok: true,
          role: "agent",
          user: { id: "agent-1" } as User,
          supabase: {} as never,
        }) as never,
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => adminClient as never,
      getFlutterwaveConfig: async () => ({
        mode: "test",
        secretKey: "flw_test_secret",
        publicKey: "flw_test_public",
        encryptionKey: null,
        keyPresent: true,
        source: "env",
        fallbackFromLive: false,
      }),
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            status: "success",
            data: {
              id: 123456,
              status: "successful",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        ),
      logFailure: () => undefined,
      logProviderPlanUpdated: () => undefined,
      logProviderVerifyOutcome: () => undefined,
      issueSubscriptionCreditsIfNeeded: async ({ subscriptionId, userId, planTier }) => {
        issuedCreditsFor = { subscriptionId, userId, planTier };
        return { issued: true };
      },
      upsertSubscriptionRecord: async () => ({
        id: "sub_fw_1",
        user_id: "agent-1",
        provider: "flutterwave",
        provider_subscription_id: "fw_ref_12345",
        status: "active",
        plan_tier: "pro",
        role: "agent",
        current_period_start: "2026-05-01T00:00:00.000Z",
        current_period_end: "2026-06-01T00:00:00.000Z",
        canceled_at: null,
      }),
      issueReferralRewardsForEvent: async () => undefined,
      computeValidUntil: () => "2026-06-01T00:00:00.000Z",
      computeProviderPlanUpdate: (planTier, validUntil) => ({
        planTier,
        validUntil,
        skipped: false,
        skipReason: null,
      }),
      isProviderEventProcessed: () => false,
      normalizeCadence: () => "monthly",
      resolveTierForRole: () => "pro",
    }
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.status, "verified");
  assert.equal(state.provider_payment_events[0]?.status, "verified");
  assert.equal(state.profile_plans[0]?.billing_source, "flutterwave");
  assert.equal(state.profile_plans[0]?.plan_tier, "pro");
  assert.deepEqual(issuedCreditsFor, {
    subscriptionId: "sub_fw_1",
    userId: "agent-1",
    planTier: "pro",
  });
});

function createStripeCheckoutCompletedEvent(profileId: string, marketCountry: "GB" | "CA"): Stripe.Event {
  return {
    id: `evt_stripe_${marketCountry.toLowerCase()}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${marketCountry.toLowerCase()}_123`,
        object: "checkout.session",
        mode: "subscription",
        subscription: `sub_${marketCountry.toLowerCase()}_123`,
        amount_total: 4999,
        metadata: {
          profile_id: profileId,
          role: "landlord",
          plan_tier: "starter",
          cadence: "monthly",
          subscription_market_country: marketCountry,
          subscription_market_currency: marketCountry === "CA" ? "CAD" : "GBP",
        },
      },
    },
  } as unknown as Stripe.Event;
}

function createStripeSubscription(subscriptionId: string, priceId: string, currency: "cad" | "gbp"): Stripe.Subscription {
  return {
    id: subscriptionId,
    object: "subscription",
    status: "active",
    customer: "cus_live_123",
    current_period_start: 1_800_000_000,
    current_period_end: 1_802_678_400,
    canceled_at: null,
    currency,
    metadata: {},
    items: {
      object: "list",
      data: [
        {
          id: "si_test_123",
          object: "subscription_item",
          price: {
            id: priceId,
            object: "price",
          },
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

void test("stripe callback requests subscription listing credits for Canada recurring checkout", async () => {
  const analyticsEvents: string[] = [];
  let creditIssueInput: { subscriptionId: string; userId: string; planTier: string | null } | null = null;

  const adminClient = {
    from(table: string) {
      if (table === "profile_plans") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: null, error: null }),
                };
              },
            };
          },
          upsert: async () => ({ error: null }),
        };
      }
      if (table === "profile_billing_notes") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: null, error: null }),
                };
              },
            };
          },
          upsert: async () => ({ error: null }),
        };
      }
      if (table === "profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: { role: "landlord" }, error: null }),
                };
              },
            };
          },
        };
      }
      if (table === "product_analytics_events") {
        return {
          insert: async (values: Record<string, unknown>) => {
            analyticsEvents.push(String(values.event_name ?? ""));
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected stripe test table: ${table}`);
    },
  };

  const response = await processStripeEvent(
    {
      adminClient: adminClient as never,
      stripe: {
        subscriptions: {
          retrieve: async (subscriptionId: string) =>
            createStripeSubscription(subscriptionId, "price_ca_starter_monthly", "cad"),
        },
      } as never,
      route: "/api/billing/stripe/webhook",
      startTime: Date.now(),
    },
    createStripeCheckoutCompletedEvent("landlord-1", "CA"),
    {
      upsertSubscriptionRecord: async () => ({
        id: "sub_row_1",
        user_id: "landlord-1",
        provider: "stripe",
        provider_subscription_id: "sub_ca_123",
        status: "active",
        plan_tier: "starter",
        role: "landlord",
        current_period_start: "2026-05-01T00:00:00.000Z",
        current_period_end: "2026-06-01T00:00:00.000Z",
        canceled_at: null,
      }),
      issueSubscriptionCreditsIfNeeded: async ({ subscriptionId, userId, planTier }) => {
        creditIssueInput = { subscriptionId, userId, planTier };
        return { issued: true };
      },
      logProductAnalyticsEvent: async ({ eventName }) => {
        analyticsEvents.push(eventName);
      },
    }
  );

  assert.equal(response.status, "processed");
  assert.equal(response.profileId, "landlord-1");
  assert.equal(response.planTier, "starter");
  assert.equal(response.applied, true);
  assert.deepEqual(creditIssueInput, {
    subscriptionId: "sub_row_1",
    userId: "landlord-1",
    planTier: "starter",
  });
  assert.ok(analyticsEvents.includes("checkout_succeeded"));
});
