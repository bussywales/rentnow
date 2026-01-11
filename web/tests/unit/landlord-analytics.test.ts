import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getLandlordAnalytics, resolveAnalyticsHostId, resolveAnalyticsRange } from "@/lib/analytics/landlord-analytics";

type MockConfig = {
  counts?: Record<string, number>;
  propertyViewsCounts?: {
    total?: number;
    anonymous?: number;
    auth?: number;
  };
  errors?: Record<string, string>;
  messages?: Array<{
    property_id: string;
    sender_id: string;
    recipient_id: string | null;
    created_at: string;
    properties?: Array<{ owner_id: string }>;
  }>;
  propertyViews?: Array<{ viewer_id: string | null }>;
};

class MockQuery {
  private readonly table: string;
  private readonly config: MockConfig;
  private head = false;
  private viewerIdFilter: "null" | "not_null" | null = null;

  constructor(table: string, config: MockConfig) {
    this.table = table;
    this.config = config;
  }

  select(_: string, options?: { count?: string; head?: boolean }) {
    this.head = Boolean(options?.head);
    return this;
  }

  eq() {
    return this;
  }

  gte() {
    return this;
  }

  lt() {
    return this;
  }

  order() {
    return this;
  }

  not() {
    this.viewerIdFilter = "not_null";
    return this;
  }

  is() {
    this.viewerIdFilter = "null";
    return this;
  }

  then(resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) {
    return Promise.resolve(this.exec()).then(resolve, reject);
  }

  private exec() {
    const errorMessage = this.config.errors?.[this.table];
    if (errorMessage) {
      return { count: null, data: null, error: { message: errorMessage } };
    }
    if (!this.head) {
      if (this.table === "messages") {
        return { data: this.config.messages ?? [], error: null };
      }
      if (this.table === "property_views") {
        return { data: this.config.propertyViews ?? [], error: null };
      }
      return { data: [], error: null };
    }
    if (this.table === "property_views") {
      if (this.viewerIdFilter === "null") {
        return { count: this.config.propertyViewsCounts?.anonymous ?? 0, error: null };
      }
      if (this.viewerIdFilter === "not_null") {
        return { count: this.config.propertyViewsCounts?.auth ?? 0, error: null };
      }
      return { count: this.config.propertyViewsCounts?.total ?? 0, error: null };
    }
    return { count: this.config.counts?.[this.table] ?? 0, error: null };
  }
}

type SupabaseLike = {
  from: (table: string) => MockQuery;
};

const createMockSupabase = (config: MockConfig): SupabaseLike => ({
  from(table: string) {
    return new MockQuery(table, config);
  },
});

void test("dashboard analytics page guards non-listing roles", () => {
  const pagePath = path.join(process.cwd(), "app", "dashboard", "analytics", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("Analytics are available to landlords and agents"),
    "expected role-gated copy"
  );
  assert.ok(
    contents.includes("canManageListings"),
    "expected role gating to use canManageListings"
  );
});

void test("admin host analytics page enforces admin guard", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "analytics", "host", "[id]", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("/forbidden?reason=role"),
    "expected admin role guard"
  );
  assert.ok(
    contents.includes("/auth/required?redirect=/admin/analytics/host"),
    "expected auth redirect with next"
  );
});

void test("host analytics panel includes Not available fallback", () => {
  const panelPath = path.join(process.cwd(), "components", "analytics", "HostAnalyticsPanel.tsx");
  const contents = fs.readFileSync(panelPath, "utf8");

  assert.ok(
    contents.includes("Not available"),
    "expected Not available fallback copy"
  );
});

void test("resolveAnalyticsHostId uses actingAs only when allowed", () => {
  const result = resolveAnalyticsHostId({
    userId: "host-a",
    role: "agent",
    actingAs: "host-b",
    canActAs: true,
  });

  assert.equal(result.hostId, "host-b");
  assert.equal(result.actingAsUsed, true);

  const fallback = resolveAnalyticsHostId({
    userId: "host-a",
    role: "agent",
    actingAs: "host-b",
    canActAs: false,
  });

  assert.equal(fallback.hostId, "host-a");
  assert.equal(fallback.actingAsUsed, false);
});

void test("resolveAnalyticsRange uses previous period offsets", () => {
  const now = new Date("2026-01-11T12:00:00Z");
  const range = resolveAnalyticsRange("last7", now);

  assert.equal(range.key, "last7");
  assert.ok(new Date(range.previousEnd).getTime() === new Date(range.start).getTime());
});

void test("property views telemetry migration enforces RLS without policies", () => {
  const migrationPath = path.join(process.cwd(), "supabase", "migrations", "042_property_views.sql");
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    contents.includes("ENABLE ROW LEVEL SECURITY"),
    "expected RLS enabled on property_views"
  );
  assert.ok(
    !contents.includes("CREATE POLICY"),
    "expected no public policies on property_views"
  );
});

void test("property detail API records views via property_views insert", () => {
  const routePath = path.join(process.cwd(), "app", "api", "properties", "[id]", "route.ts");
  const contents = fs.readFileSync(routePath, "utf8");

  assert.ok(contents.includes("property_views"), "expected property_views insert");
  assert.ok(contents.includes("viewer_role"), "expected viewer_role capture");
});

void test("getLandlordAnalytics returns total, unique, and anonymous view metrics", async () => {
  const supabase = createMockSupabase({
    counts: { properties: 2, saved_properties: 1, viewing_requests: 0 },
    propertyViewsCounts: { total: 6, anonymous: 2, auth: 2 },
    propertyViews: [
      { viewer_id: "viewer-a" },
      { viewer_id: "viewer-a" },
      { viewer_id: "viewer-b" },
      { viewer_id: null },
    ],
    messages: [],
  });

  const snapshot = await getLandlordAnalytics({
    hostId: "host-1",
    supabase: supabase as unknown as SupabaseLike,
    viewsClient: supabase as unknown as SupabaseLike,
  });

  assert.equal(snapshot.kpis.listingViews.value, 6);
  assert.equal(snapshot.kpis.uniqueAuthViewers.value, 2);
  assert.equal(snapshot.kpis.anonymousViews.value, 2);
});

void test("getLandlordAnalytics marks listing views unavailable when source errors", async () => {
  const supabase = createMockSupabase({
    counts: { properties: 3, saved_properties: 1, viewing_requests: 1 },
    errors: { property_views: "relation does not exist" },
    messages: [
      {
        property_id: "prop-1",
        sender_id: "tenant-1",
        recipient_id: "host-1",
        created_at: "2026-01-11T10:00:00Z",
        properties: [{ owner_id: "host-1" }],
      },
    ],
  });

  const snapshot = await getLandlordAnalytics({
    hostId: "host-1",
    supabase: supabase as unknown as SupabaseLike,
    viewsClient: supabase as unknown as SupabaseLike,
  });

  assert.equal(snapshot.kpis.listingViews.available, false);
  assert.equal(snapshot.kpis.uniqueAuthViewers.available, false);
  assert.equal(snapshot.kpis.anonymousViews.available, false);
  assert.equal(snapshot.kpis.listingViews.value, null);
});
