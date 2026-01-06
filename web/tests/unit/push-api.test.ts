import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";

import { getPushStatusResponse } from "../../app/api/push/status/route";
import { postPushSubscribeResponse } from "../../app/api/push/subscribe/route";
import { postPushUnsubscribeResponse } from "../../app/api/push/unsubscribe/route";

type QueryResult = { count?: number | null; error?: { message: string } | null };

function createThenable(result: QueryResult) {
  return {
    then: (resolve: (value: QueryResult) => void) => resolve(result),
  };
}

void test("push status queries active subscriptions for the current user", async () => {
  const eqCalls: Array<[string, unknown]> = [];
  const supabase = {
    from: (table: string) => {
      assert.equal(table, "push_subscriptions");
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          eqCalls.push([column, value]);
          return query;
        },
        then: (resolve: (value: QueryResult) => void) =>
          resolve({ count: 2, error: null }),
      };
      return query;
    },
  };

  const response = await getPushStatusResponse(
    new Request("http://localhost/api/push/status"),
    {
      hasServerSupabaseEnv: () => true,
      getPushConfig: () => ({
        configured: true,
        publicKey: "public",
        privateKey: "private",
        subject: "https://example.com",
      }),
      requireUser: async () => ({
        ok: true,
        user: { id: "user-123" },
        supabase,
      }),
      logFailure: () => undefined,
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(eqCalls, [
    ["profile_id", "user-123"],
    ["is_active", true],
  ]);
});

void test("push subscribe upserts subscription for the current user", async () => {
  let upsertPayload: Record<string, unknown> | null = null;
  let upsertOnConflict: string | null = null;
  const supabase = {
    from: (table: string) => {
      assert.equal(table, "push_subscriptions");
      return {
        upsert: (payload: Record<string, unknown>, options: { onConflict?: string }) => {
          upsertPayload = payload;
          upsertOnConflict = options.onConflict ?? null;
          return createThenable({ error: null });
        },
      };
    },
  };

  const response = await postPushSubscribeResponse(
    new Request("http://localhost/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://example.com/endpoint",
        keys: { p256dh: "key", auth: "auth" },
      }),
    }),
    {
      hasServerSupabaseEnv: () => true,
      getPushConfig: () => ({
        configured: true,
        publicKey: "public",
        privateKey: "private",
        subject: "https://example.com",
      }),
      requireUser: async () => ({
        ok: true,
        user: { id: "user-123" },
        supabase,
      }),
      logFailure: () => undefined,
    }
  );

  assert.equal(response.status, 200);
  assert.ok(upsertPayload);
  assert.equal(upsertPayload.profile_id, "user-123");
  assert.equal(upsertPayload.endpoint, "https://example.com/endpoint");
  assert.equal(upsertPayload.is_active, true);
  assert.ok(upsertPayload.last_seen_at);
  assert.equal(upsertOnConflict, "profile_id,endpoint");
});

void test("push unsubscribe deletes subscription for the current user", async () => {
  const eqCalls: Array<[string, unknown]> = [];
  const supabase = {
    from: (table: string) => {
      assert.equal(table, "push_subscriptions");
      const query = {
        delete: () => query,
        eq: (column: string, value: unknown) => {
          eqCalls.push([column, value]);
          return query;
        },
        then: (resolve: (value: QueryResult) => void) =>
          resolve({ error: null }),
      };
      return query;
    },
  };

  const response = await postPushUnsubscribeResponse(
    new Request("http://localhost/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "https://example.com/endpoint" }),
    }),
    {
      hasServerSupabaseEnv: () => true,
      requireUser: async () => ({
        ok: true,
        user: { id: "user-123" },
        supabase,
      }),
      logFailure: () => undefined,
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(eqCalls, [
    ["profile_id", "user-123"],
    ["endpoint", "https://example.com/endpoint"],
  ]);
});

void test("push subscribe returns 503 when not configured", async () => {
  const response = await postPushSubscribeResponse(
    new Request("http://localhost/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: "https://example.com/endpoint",
        keys: { p256dh: "key", auth: "auth" },
      }),
    }),
    {
      hasServerSupabaseEnv: () => true,
      getPushConfig: () => ({
        configured: false,
        publicKey: null,
        privateKey: null,
        subject: "https://example.com",
      }),
      requireUser: async () => ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }),
      logFailure: () => undefined,
    }
  );

  assert.equal(response.status, 503);
});
