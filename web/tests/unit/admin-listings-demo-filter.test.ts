import test from "node:test";
import assert from "node:assert/strict";
import { getAdminAllListings } from "@/lib/admin/admin-listings";
import { DEFAULT_ADMIN_LISTINGS_QUERY } from "@/lib/admin/admin-listings-query";

class MockBuilder {
  clauses: string[] = [];
  data: unknown[];
  count: number;
  error: unknown = null;

  constructor(data: unknown[]) {
    this.data = data;
    this.count = data.length;
  }

  eq(field: string, val: unknown) {
    this.clauses.push(`eq:${field}:${val}`);
    return this;
  }
  in(field: string, vals: unknown[]) {
    this.clauses.push(`in:${field}:${vals.length}`);
    return this;
  }
  or(val: string) {
    this.clauses.push(`or:${val}`);
    return this;
  }
  gte(field: string, val: unknown) {
    this.clauses.push(`gte:${field}:${val}`);
    return this;
  }
  lte(field: string, val: unknown) {
    this.clauses.push(`lte:${field}:${val}`);
    return this;
  }
  order(field: string, opts: { ascending: boolean }) {
    this.clauses.push(`order:${field}:${opts.ascending ? "asc" : "desc"}`);
    return this;
  }
  range(from: number, to: number) {
    this.clauses.push(`range:${from}:${to}`);
    return this;
  }
  then(onFulfilled: (value: unknown) => unknown) {
    return Promise.resolve(
      onFulfilled({ data: this.data, count: this.count, error: this.error, status: 200 })
    );
  }
}

class MockClient {
  lastBuilder: MockBuilder | null = null;
  from() {
    return {
      select: () => {
        this.lastBuilder = new MockBuilder([{ id: "1", status: "live" }]);
        return this.lastBuilder;
      },
    };
  }
}

void test("getAdminAllListings applies demo=true filter", async () => {
  const client = new MockClient();
  await getAdminAllListings({
    client: client as unknown as Parameters<typeof getAdminAllListings>[0]["client"],
    query: { ...DEFAULT_ADMIN_LISTINGS_QUERY, demo: "true", pageSize: 10 },
  });
  assert.ok(client.lastBuilder?.clauses.includes("eq:is_demo:true"));
});

void test("getAdminAllListings applies demo=false filter", async () => {
  const client = new MockClient();
  await getAdminAllListings({
    client: client as unknown as Parameters<typeof getAdminAllListings>[0]["client"],
    query: { ...DEFAULT_ADMIN_LISTINGS_QUERY, demo: "false", pageSize: 10 },
  });
  assert.ok(client.lastBuilder?.clauses.includes("eq:is_demo:false"));
});

void test("getAdminAllListings does not apply demo filter when demo=all", async () => {
  const client = new MockClient();
  await getAdminAllListings({
    client: client as unknown as Parameters<typeof getAdminAllListings>[0]["client"],
    query: { ...DEFAULT_ADMIN_LISTINGS_QUERY, demo: "all", pageSize: 10 },
  });
  assert.equal(
    (client.lastBuilder?.clauses ?? []).some((clause) => clause.startsWith("eq:is_demo:")),
    false
  );
});

