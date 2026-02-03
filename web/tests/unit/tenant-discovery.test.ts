import test from "node:test";
import assert from "node:assert/strict";
import {
  getFeaturedHomes,
  getPopularHomes,
  getNewHomes,
  buildTenantDiscoveryModules,
  type DiscoveryContext,
} from "@/lib/tenant/tenant-discovery.server";

class QueryStub {
  calls: Array<{ method: string; args: unknown[] }> = [];

  select(...args: unknown[]) {
    this.calls.push({ method: "select", args });
    return this;
  }

  eq(...args: unknown[]) {
    this.calls.push({ method: "eq", args });
    return this;
  }

  or(...args: unknown[]) {
    this.calls.push({ method: "or", args });
    return this;
  }

  gte(...args: unknown[]) {
    this.calls.push({ method: "gte", args });
    return this;
  }

  ilike(...args: unknown[]) {
    this.calls.push({ method: "ilike", args });
    return this;
  }

  order(...args: unknown[]) {
    this.calls.push({ method: "order", args });
    return this;
  }

  limit(...args: unknown[]) {
    this.calls.push({ method: "limit", args });
    return Promise.resolve({ data: [] });
  }
}

function buildContext() {
  const query = new QueryStub();
  const supabase = {
    from: () => query,
  } as unknown as DiscoveryContext["supabase"];

  const context: DiscoveryContext = {
    supabase,
    userId: "tenant-1",
    role: "tenant",
    approvedBefore: null,
    profileCity: null,
    profileJurisdiction: null,
  };

  return { query, context };
}

void test("tenant discovery queries filter to live listings", async () => {
  const { query, context } = buildContext();

  await getPopularHomes({ city: "Lagos", context });

  const eqCalls = query.calls.filter((call) => call.method === "eq");
  assert.ok(
    eqCalls.some((call) => call.args[0] === "status" && call.args[1] === "live"),
    "expected live status filter"
  );
  assert.ok(
    eqCalls.some((call) => call.args[0] === "is_active" && call.args[1] === true),
    "expected active filter"
  );
  assert.ok(
    eqCalls.some((call) => call.args[0] === "is_approved" && call.args[1] === true),
    "expected approved filter"
  );
});

void test("featured homes query respects featured_until", async () => {
  const { query, context } = buildContext();

  await getFeaturedHomes({ context });

  const orCalls = query.calls.filter((call) => call.method === "or");
  assert.ok(
    orCalls.some(
      (call) =>
        typeof call.args[0] === "string" &&
        (call.args[0] as string).includes("featured_until")
    ),
    "expected featured_until filter"
  );
  assert.ok(
    orCalls.some(
      (call) =>
        typeof call.args[0] === "string" &&
        (call.args[0] as string).includes("featured_until.gt")
    ),
    "expected featured_until gt filter"
  );
  const eqCalls = query.calls.filter((call) => call.method === "eq");
  assert.ok(
    eqCalls.some((call) => call.args[0] === "is_featured" && call.args[1] === true),
    "expected is_featured filter"
  );
  const orderCalls = query.calls.filter((call) => call.method === "order");
  assert.ok(
    orderCalls.some(
      (call) =>
        call.args[0] === "featured_rank" &&
        typeof call.args[1] === "object" &&
        (call.args[1] as { ascending?: boolean }).ascending === true
    ),
    "expected featured_rank ascending order"
  );
  assert.ok(
    orderCalls.some((call) => call.args[0] === "updated_at"),
    "expected updated_at order"
  );
});

void test("new homes query constrains created_at", async () => {
  const { query, context } = buildContext();

  await getNewHomes({ context, days: 7 });

  const gteCalls = query.calls.filter((call) => call.method === "gte");
  assert.ok(
    gteCalls.some((call) => call.args[0] === "created_at"),
    "expected created_at window filter"
  );
});

void test("tenant discovery falls back when no modules are available", () => {
  const modules = buildTenantDiscoveryModules({
    featuredHomes: [],
    popularHomes: [],
    newHomes: [],
  });
  assert.equal(modules.hasModules, false);
  assert.equal(modules.hasFeatured, false);
  assert.equal(modules.hasPopular, false);
  assert.equal(modules.hasNew, false);
});
