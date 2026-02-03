import test from "node:test";
import assert from "node:assert/strict";
import { postSeenResponse, type PresenceDeps } from "@/app/api/me/seen/route";
import { fetchProductUpdatesSinceLastVisit } from "@/lib/product-updates/product-updates.server";

type SupabaseStub = {
  from: (table: string) => unknown;
};

void test("presence endpoint updates last_seen_at", async () => {
  let updatedAt: string | null = null;
  const supabase: SupabaseStub = {
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`Unexpected table ${table}`);
      return {
        update: (payload: { last_seen_at: string }) => {
          updatedAt = payload.last_seen_at;
          return {
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: { last_seen_at: payload.last_seen_at }, error: null }),
              }),
            }),
          };
        },
      };
    },
  };

  const res = await postSeenResponse(new Request("http://localhost/api/me/seen", { method: "POST" }), {
    hasServerSupabaseEnv: () => true,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "user-1" },
        supabase,
      }) as Awaited<ReturnType<PresenceDeps["requireUser"]>>,
    logFailure: () => undefined,
    now: () => "2026-02-04T10:00:00Z",
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(updatedAt, "2026-02-04T10:00:00Z");
  assert.equal(body.last_seen_at, "2026-02-04T10:00:00Z");
});

void test("updates since last visit filter by published_at + audience", async () => {
  const updates = [
    { id: "u1", title: "Old", published_at: "2026-01-20T10:00:00Z", audience: "tenant" },
    { id: "u2", title: "New", published_at: "2026-02-02T10:00:00Z", audience: "tenant" },
    { id: "u3", title: "All", published_at: "2026-02-03T10:00:00Z", audience: "all" },
    { id: "u4", title: "Admin only", published_at: "2026-02-04T10:00:00Z", audience: "admin" },
  ];

  const supabase: SupabaseStub = {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { last_seen_at: "2026-02-01T00:00:00Z" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "product_updates") {
        let filtered = [...updates];
        let ascending = false;
        const query = {
          select: () => query,
          not: () => query,
          order: (_col: string, options?: { ascending?: boolean }) => {
            ascending = options?.ascending ?? false;
            return query;
          },
          in: (_col: string, audiences: string[]) => {
            filtered = filtered.filter((row) => audiences.includes(row.audience));
            return query;
          },
          gt: (_col: string, value: string) => {
            filtered = filtered.filter((row) => row.published_at > value);
            return query;
          },
          limit: async (limit: number) => ({
            data: [...filtered]
              .sort((a, b) => {
                const aTime = a.published_at ?? "";
                const bTime = b.published_at ?? "";
                return ascending ? aTime.localeCompare(bTime) : bTime.localeCompare(aTime);
              })
              .slice(0, limit),
            error: null,
            count: filtered.length,
          }),
        };
        return query;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  const result = await fetchProductUpdatesSinceLastVisit({
    client: supabase as never,
    role: "tenant",
    userId: "user-1",
    limit: 5,
  });

  assert.equal(result.count, 2);
  assert.deepEqual(
    result.latest.map((row) => row.id),
    ["u3", "u2"]
  );
});
