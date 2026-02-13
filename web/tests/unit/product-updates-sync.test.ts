import test from "node:test";
import assert from "node:assert/strict";
import {
  syncProductUpdateDraftsFromDocs,
  type ProductUpdatesSyncSummary,
} from "@/lib/product-updates/sync.server";
import type { UpdateNoteFile } from "@/lib/product-updates/update-notes.server";

type StoredRow = {
  id: string;
  source_ref: string;
  source_hash: string;
  audience: string;
  published_at: string | null;
  title: string;
  summary: string;
  body: string | null;
  created_by: string | null;
};

function createMemoryClient(seed: StoredRow[] = []) {
  let auto = seed.length;
  const rows = new Map<string, StoredRow>();
  for (const row of seed) {
    rows.set(`${row.source_ref}|${row.audience}`, row);
  }

  return {
    rows,
    client: {
      from() {
        return {
          select() {
            return {
              eq(_columnA: string, valueA: unknown) {
                return {
                  eq(_columnB: string, valueB: unknown) {
                    return {
                      async maybeSingle() {
                        const row = rows.get(`${String(valueA)}|${String(valueB)}`) ?? null;
                        if (!row) return { data: null, error: null };
                        return {
                          data: {
                            id: row.id,
                            source_hash: row.source_hash,
                            published_at: row.published_at,
                          },
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
          update(payload: Record<string, unknown>) {
            return {
              async eq(_column: string, id: unknown) {
                const target = Array.from(rows.values()).find((row) => row.id === id);
                if (!target) {
                  return { error: new Error("missing row") };
                }
                const updated: StoredRow = {
                  ...target,
                  title: String(payload.title ?? target.title),
                  summary: String(payload.summary ?? target.summary),
                  body: (payload.body as string | null | undefined) ?? target.body,
                  source_hash: String(payload.source_hash ?? target.source_hash),
                  published_at: (payload.published_at as string | null | undefined) ?? target.published_at,
                };
                rows.set(`${updated.source_ref}|${updated.audience}`, updated);
                return { error: null };
              },
            };
          },
          async insert(payload: Record<string, unknown>) {
            auto += 1;
            const inserted: StoredRow = {
              id: `row-${auto}`,
              source_ref: String(payload.source_ref ?? ""),
              source_hash: String(payload.source_hash ?? ""),
              audience: String(payload.audience ?? ""),
              published_at: (payload.published_at as string | null | undefined) ?? null,
              title: String(payload.title ?? ""),
              summary: String(payload.summary ?? ""),
              body: (payload.body as string | null | undefined) ?? null,
              created_by: (payload.created_by as string | null | undefined) ?? null,
            };
            rows.set(`${inserted.source_ref}|${inserted.audience}`, inserted);
            return { error: null };
          },
        };
      },
    },
  };
}

function buildNote(overrides?: Partial<UpdateNoteFile>): UpdateNoteFile {
  return {
    filename: "2026-02-13-test-note.md",
    title: "Test note",
    audiences: ["TENANT", "AGENT"],
    areas: ["Search"],
    body: "Body",
    summary: "Body",
    source_hash: "hash-1",
    ...overrides,
  };
}

void test("syncProductUpdateDraftsFromDocs is idempotent for unchanged source hashes", async () => {
  const memory = createMemoryClient();

  const deps = {
    listUpdateNotes: async () => ({
      notes: [buildNote()],
      invalidNotes: [],
    }),
  };

  const first = await syncProductUpdateDraftsFromDocs({
    client: memory.client as never,
    actorId: "admin-1",
    deps,
  });

  assert.equal(first.created, 2);
  assert.equal(first.updated, 0);
  assert.equal(first.unchanged, 0);
  assert.equal(first.skippedInvalid, 0);

  const second = await syncProductUpdateDraftsFromDocs({
    client: memory.client as never,
    actorId: "admin-1",
    deps,
  });

  assert.equal(second.created, 0);
  assert.equal(second.updated, 0);
  assert.equal(second.unchanged, 2);
  assert.equal(second.skippedInvalid, 0);
});

void test("syncProductUpdateDraftsFromDocs skips invalid notes and preserves parse issues", async () => {
  const memory = createMemoryClient();
  const summary: ProductUpdatesSyncSummary = await syncProductUpdateDraftsFromDocs({
    client: memory.client as never,
    actorId: "admin-1",
    deps: {
      listUpdateNotes: async () => ({
        notes: [buildNote({ audiences: [], areas: [] })],
        invalidNotes: [{ filename: "broken.md", error: "missing frontmatter" }],
      }),
    },
  });

  assert.equal(summary.created, 0);
  assert.equal(summary.updated, 0);
  assert.equal(summary.unchanged, 0);
  assert.equal(summary.processedNotes, 0);
  assert.equal(summary.skippedInvalid, 2);
  assert.equal(summary.invalidNotes.length, 2);
});
