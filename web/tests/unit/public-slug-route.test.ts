import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  patchPublicSlugResponse,
  type PublicSlugRouteDeps,
} from "@/app/api/settings/public-slug/route";

type ProfileRow = {
  id: string;
  role: string;
  public_slug: string | null;
};

type HistoryRow = {
  profile_id: string;
  old_slug: string;
  new_slug: string;
  changed_at: string;
};

type MockState = {
  profiles: ProfileRow[];
  history: HistoryRow[];
};

function buildMockClient(state: MockState) {
  const selectProfiles = () => {
    let filterEq: { column: string; value: unknown } | null = null;
    let filterIlike: { column: string; value: string } | null = null;
    return {
      eq(column: string, value: unknown) {
        filterEq = { column, value };
        return this;
      },
      ilike(column: string, value: string) {
        filterIlike = { column, value: value.toLowerCase() };
        return this;
      },
      limit() {
        return this;
      },
      async maybeSingle() {
        let rows = [...state.profiles];
        if (filterEq?.column === "id") {
          rows = rows.filter((row) => row.id === filterEq?.value);
        }
        if (filterIlike?.column === "public_slug") {
          rows = rows.filter((row) => (row.public_slug ?? "").toLowerCase() === filterIlike?.value);
        }
        return { data: rows[0] ?? null, error: null };
      },
    };
  };

  const selectHistory = () => {
    let filterEq: { column: string; value: unknown } | null = null;
    let filterIlike: { column: string; value: string } | null = null;
    let orderByChangedAt = false;
    return {
      eq(column: string, value: unknown) {
        filterEq = { column, value };
        return this;
      },
      ilike(column: string, value: string) {
        filterIlike = { column, value: value.toLowerCase() };
        return this;
      },
      order(column: string) {
        if (column === "changed_at") orderByChangedAt = true;
        return this;
      },
      limit() {
        return this;
      },
      async maybeSingle() {
        let rows = [...state.history];
        if (filterEq?.column === "profile_id") {
          rows = rows.filter((row) => row.profile_id === filterEq?.value);
        }
        if (filterIlike?.column === "old_slug") {
          rows = rows.filter((row) => row.old_slug.toLowerCase() === filterIlike?.value);
        }
        if (orderByChangedAt) {
          rows.sort((a, b) => Date.parse(b.changed_at) - Date.parse(a.changed_at));
        }
        return { data: rows[0] ?? null, error: null };
      },
    };
  };

  return {
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => selectProfiles(),
          update(payload: { public_slug?: string | null }) {
            return {
              async eq(column: string, value: unknown) {
                if (column === "id") {
                  const row = state.profiles.find((profile) => profile.id === value);
                  if (row && typeof payload.public_slug === "string") {
                    row.public_slug = payload.public_slug;
                  }
                }
                return { error: null };
              },
            };
          },
        };
      }
      if (table === "profile_slug_history") {
        return {
          select: () => selectHistory(),
          async insert(payload: {
            profile_id: string;
            old_slug: string;
            new_slug: string;
          }) {
            const exists = state.history.some(
              (row) => row.old_slug.toLowerCase() === payload.old_slug.toLowerCase()
            );
            if (exists) {
              return { error: { code: "23505", message: "duplicate key value" } };
            }
            state.history.push({
              ...payload,
              changed_at: new Date().toISOString(),
            });
            return { error: null };
          },
          delete() {
            return {
              eq(column: string, value: unknown) {
                return {
                  eq(column2: string, value2: unknown) {
                    return {
                      async eq(column3: string, value3: unknown) {
                        state.history = state.history.filter(
                          (row) =>
                            !(
                              (column === "profile_id" ? row.profile_id === value : true) &&
                              (column2 === "old_slug" ? row.old_slug === value2 : true) &&
                              (column3 === "new_slug" ? row.new_slug === value3 : true)
                            )
                        );
                        return { error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unhandled table ${table}`);
    },
  };
}

function buildDeps(state: MockState): PublicSlugRouteDeps {
  const supabase = buildMockClient(state);
  return {
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "agent-1" } as User,
        role: "agent",
      }) as Awaited<ReturnType<PublicSlugRouteDeps["requireRole"]>>,
    hasServiceRoleEnv: () => false,
    createServiceRoleClient: () =>
      ({} as ReturnType<PublicSlugRouteDeps["createServiceRoleClient"]>),
  };
}

void test("PATCH /api/settings/public-slug rejects reserved words", async () => {
  const state: MockState = {
    profiles: [{ id: "agent-1", role: "agent", public_slug: "old-link" }],
    history: [],
  };
  const req = new Request("http://localhost/api/settings/public-slug", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "admin" }),
  });
  const res = await patchPublicSlugResponse(req, buildDeps(state));
  assert.equal(res.status, 422);
});

void test("PATCH /api/settings/public-slug enforces seven-day cooldown", async () => {
  const state: MockState = {
    profiles: [{ id: "agent-1", role: "agent", public_slug: "old-link" }],
    history: [
      {
        profile_id: "agent-1",
        old_slug: "older-link",
        new_slug: "old-link",
        changed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };
  const req = new Request("http://localhost/api/settings/public-slug", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "new-link" }),
  });
  const res = await patchPublicSlugResponse(req, buildDeps(state));
  assert.equal(res.status, 429);
});

void test("PATCH /api/settings/public-slug rejects slugs present in history or profiles", async () => {
  const state: MockState = {
    profiles: [
      { id: "agent-1", role: "agent", public_slug: "old-link" },
      { id: "agent-2", role: "agent", public_slug: "taken-link" },
    ],
    history: [
      {
        profile_id: "agent-2",
        old_slug: "legacy-link",
        new_slug: "taken-link",
        changed_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  };

  const takenReq = new Request("http://localhost/api/settings/public-slug", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "taken-link" }),
  });
  const takenRes = await patchPublicSlugResponse(takenReq, buildDeps(state));
  assert.equal(takenRes.status, 409);

  const legacyReq = new Request("http://localhost/api/settings/public-slug", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "legacy-link" }),
  });
  const legacyRes = await patchPublicSlugResponse(legacyReq, buildDeps(state));
  assert.equal(legacyRes.status, 409);
});

void test("PATCH /api/settings/public-slug updates slug and writes history", async () => {
  const state: MockState = {
    profiles: [{ id: "agent-1", role: "agent", public_slug: "old-link" }],
    history: [
      {
        profile_id: "agent-1",
        old_slug: "much-older-link",
        new_slug: "old-link",
        changed_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
  const req = new Request("http://localhost/api/settings/public-slug", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "fresh-link" }),
  });
  const res = await patchPublicSlugResponse(req, buildDeps(state));
  assert.equal(res.status, 200);
  assert.equal(state.profiles[0]?.public_slug, "fresh-link");
  assert.ok(state.history.some((row) => row.old_slug === "old-link" && row.new_slug === "fresh-link"));
});

void test("PATCH /api/settings/public-slug blocks non-agent roles", async () => {
  const deps: PublicSlugRouteDeps = {
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<PublicSlugRouteDeps["requireRole"]>>,
    hasServiceRoleEnv: () => false,
    createServiceRoleClient: () =>
      ({} as ReturnType<PublicSlugRouteDeps["createServiceRoleClient"]>),
  };
  const req = new Request("http://localhost/api/settings/public-slug", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "new-link" }),
  });
  const res = await patchPublicSlugResponse(req, deps);
  assert.equal(res.status, 403);
});
