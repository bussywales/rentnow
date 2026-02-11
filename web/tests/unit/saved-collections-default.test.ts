import test from "node:test";
import assert from "node:assert/strict";
import { ensureDefaultCollection } from "@/lib/saved-collections.server";

type Row = {
  id: string;
  owner_user_id: string;
  title: string;
  share_id: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

function createSupabaseStub(options?: { raceInsertDuplicate?: boolean }) {
  const rows: Row[] = [];
  let insertCalls = 0;

  const supabase = {
    from: (table: string) => {
      assert.equal(table, "saved_collections");
      const filters: Record<string, unknown> = {};
      return {
        select: () => ({
          eq: (key: string, value: unknown) => {
            filters[key] = value;
            return {
              eq: (key2: string, value2: unknown) => {
                filters[key2] = value2;
                return {
                  maybeSingle: async () => {
                    const match = rows.find(
                      (row) =>
                        row.owner_user_id === filters.owner_user_id &&
                        row.is_default === filters.is_default
                    );
                    return { data: match ?? null, error: null };
                  },
                };
              },
              maybeSingle: async () => {
                const match = rows.find(
                  (row) =>
                    row.owner_user_id === filters.owner_user_id &&
                    row.is_default === filters.is_default
                );
                return { data: match ?? null, error: null };
              },
            };
          },
          maybeSingle: async () => {
            const match = rows.find(
              (row) =>
                row.owner_user_id === filters.owner_user_id &&
                row.is_default === filters.is_default
            );
            return { data: match ?? null, error: null };
          },
        }),
        insert: (payload: Record<string, unknown>) => ({
          select: () => ({
            maybeSingle: async () => {
              insertCalls += 1;
              const ownerId = String(payload.owner_user_id || "");
              if (options?.raceInsertDuplicate && insertCalls === 1) {
                rows.push({
                  id: "race-default",
                  owner_user_id: ownerId,
                  title: String(payload.title || "Favourites"),
                  share_id: null,
                  is_default: true,
                  created_at: String(payload.created_at || new Date().toISOString()),
                  updated_at: String(payload.updated_at || new Date().toISOString()),
                });
                return {
                  data: null,
                  error: { code: "23505", message: "duplicate key value violates unique constraint" },
                };
              }

              if (rows.some((row) => row.owner_user_id === ownerId && row.is_default)) {
                return {
                  data: null,
                  error: { code: "23505", message: "duplicate key value violates unique constraint" },
                };
              }

              const created: Row = {
                id: `default-${insertCalls}`,
                owner_user_id: ownerId,
                title: String(payload.title || "Favourites"),
                share_id: null,
                is_default: true,
                created_at: String(payload.created_at || new Date().toISOString()),
                updated_at: String(payload.updated_at || new Date().toISOString()),
              };
              rows.push(created);
              return { data: created, error: null };
            },
          }),
        }),
      };
    },
  };

  return {
    supabase,
    getInsertCalls: () => insertCalls,
    getRows: () => rows,
  };
}

void test("ensureDefaultCollection creates once and reuses existing collection", async () => {
  const stub = createSupabaseStub();

  const first = await ensureDefaultCollection({
    supabase: stub.supabase as never,
    userId: "user-1",
  });
  const second = await ensureDefaultCollection({
    supabase: stub.supabase as never,
    userId: "user-1",
  });

  assert.equal(first.id, second.id);
  assert.equal(stub.getRows().length, 1);
  assert.equal(stub.getInsertCalls(), 1);
});

void test("ensureDefaultCollection handles duplicate insert races idempotently", async () => {
  const stub = createSupabaseStub({ raceInsertDuplicate: true });

  const result = await ensureDefaultCollection({
    supabase: stub.supabase as never,
    userId: "user-2",
  });

  assert.equal(result.id, "race-default");
  assert.equal(stub.getRows().length, 1);
  assert.equal(stub.getInsertCalls(), 1);
});
