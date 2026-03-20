import test from "node:test";
import assert from "node:assert/strict";

import { finalizePaystackSubscriptionEvent } from "@/lib/billing/paystack-subscriptions.server";
import type { UntypedAdminClient, UntypedQuery, UntypedQueryResult, UntypedQuerySingleResult } from "@/lib/supabase/untyped";

class MockQuery<T extends Record<string, unknown>> implements UntypedQuery<T> {
  private filters: Array<{ column: string; value: string | number | boolean | null }> = [];
  private operation: "select" | "update" | "upsert" | "insert" = "select";
  private payload: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private onConflict: string | null = null;

  constructor(
    private readonly table: string,
    private readonly state: Record<string, Record<string, unknown>[]>
  ) {}

  select(columns: string) {
    void columns;
    return this;
  }

  update(values: Record<string, unknown>) {
    this.operation = "update";
    this.payload = values;
    return this;
  }

  delete() {
    throw new Error("delete not implemented in mock");
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

  in() {
    throw new Error("in not implemented in mock");
  }

  gte() {
    throw new Error("gte not implemented in mock");
  }

  lte() {
    throw new Error("lte not implemented in mock");
  }

  lt() {
    throw new Error("lt not implemented in mock");
  }

  not() {
    throw new Error("not not implemented in mock");
  }

  ilike() {
    throw new Error("ilike not implemented in mock");
  }

  order() {
    return this;
  }

  range() {
    return this;
  }

  async maybeSingle(): Promise<UntypedQuerySingleResult<T>> {
    const result = await this.execute();
    if (Array.isArray(result.data)) {
      return { data: (result.data[0] as T | null) ?? null, error: result.error };
    }
    return { data: (result.data as T | null) ?? null, error: result.error };
  }

  then<TResult1 = UntypedQueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: UntypedQueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<UntypedQueryResult<T>> {
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
    const inserted: Record<string, unknown>[] = [];
    for (const row of upsertRows) {
      const existing = this.findByConflict(rows, row);
      if (existing) {
        Object.assign(existing, row);
        inserted.push(existing);
      } else {
        const created = { id: row.id ?? `${this.table}_${rows.length + inserted.length + 1}`, ...row };
        rows.push(created);
        inserted.push(created);
      }
    }
    return { data: inserted as T[], error: null };
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

function createMockAdminClient(state: Record<string, Record<string, unknown>[]>) {
  return {
    from<T extends Record<string, unknown>>(table: string) {
      return new MockQuery<T>(table, state);
    },
  } as UntypedAdminClient;
}

void test("finalizePaystackSubscriptionEvent verifies and applies subscription state without callback actor", async () => {
  const reference = "ps_ref_12345678";
  const state: Record<string, Record<string, unknown>[]> = {
    provider_payment_events: [
      {
        id: "evt_1",
        provider: "paystack",
        reference,
        profile_id: "user_1",
        plan_tier: "tenant_pro",
        cadence: "monthly",
        status: "initialized",
        processed_at: null,
        mode: "test",
        amount: 90000,
        currency: "NGN",
        transaction_id: null,
      },
    ],
    profile_plans: [],
  };

  const adminClient = createMockAdminClient(state);
  let subscriptionUpserted = false;
  let creditsIssued = false;
  let referralIssued = false;

  const result = await finalizePaystackSubscriptionEvent({
    adminClient,
    reference,
    actorUserId: null,
    getConfig: async () => ({
      mode: "test",
      secretKey: "sk_test_paystack",
      publicKey: "pk_test_paystack",
      keyPresent: true,
      source: "env",
      fallbackFromLive: false,
    }),
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          status: true,
          data: {
            status: "success",
            id: 12345,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      ),
    upsertSubscriptionRecordFn: async () => {
      subscriptionUpserted = true;
      return {
        id: "sub_1",
        user_id: "user_1",
        provider: "paystack",
        provider_subscription_id: reference,
        status: "active",
        plan_tier: "tenant_pro",
        role: "tenant",
        current_period_start: "2026-03-20T12:00:00.000Z",
        current_period_end: "2026-04-20T12:00:00.000Z",
        canceled_at: null,
      };
    },
    issueSubscriptionCreditsIfNeededFn: async () => {
      creditsIssued = true;
      return { issued: true };
    },
    issueReferralRewardsFn: async () => {
      referralIssued = true;
    },
  });

  assert.equal(result.status, "verified");
  assert.equal(subscriptionUpserted, true);
  assert.equal(creditsIssued, true);
  assert.equal(referralIssued, true);
  assert.equal(state.profile_plans.length, 1);
  assert.equal(state.profile_plans[0]?.billing_source, "paystack");
  assert.equal(state.profile_plans[0]?.plan_tier, "tenant_pro");
  assert.equal(state.profile_plans[0]?.updated_by ?? null, null);
  assert.equal(state.provider_payment_events[0]?.status, "verified");
  assert.equal(state.provider_payment_events[0]?.transaction_id, "12345");
});

void test("finalizePaystackSubscriptionEvent is idempotent for already processed records", async () => {
  const reference = "ps_ref_processed";
  const state: Record<string, Record<string, unknown>[]> = {
    provider_payment_events: [
      {
        id: "evt_2",
        provider: "paystack",
        reference,
        profile_id: "user_2",
        plan_tier: "pro",
        cadence: "yearly",
        status: "verified",
        processed_at: "2026-03-20T12:00:00.000Z",
        mode: "live",
        amount: 490000,
        currency: "NGN",
        transaction_id: "tx_999",
      },
    ],
  };

  let fetchCalled = false;
  const result = await finalizePaystackSubscriptionEvent({
    adminClient: createMockAdminClient(state),
    reference,
    getConfig: async () => {
      throw new Error("config should not be resolved for processed events");
    },
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error("fetch should not be called for processed events");
    },
  });

  assert.equal(result.status, "verified");
  assert.equal(result.mode, "live");
  assert.equal(fetchCalled, false);
  assert.equal(state.provider_payment_events[0]?.status, "verified");
});
