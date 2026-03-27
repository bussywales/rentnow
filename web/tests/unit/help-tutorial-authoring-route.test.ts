import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  postAdminHelpTutorialsResponse,
  type AdminHelpTutorialRouteDeps,
} from "@/app/api/admin/help/tutorials/route";
import { patchAdminHelpTutorialResponse } from "@/app/api/admin/help/tutorials/[id]/route";
import type { HelpTutorialRecord } from "@/lib/help/tutorials";

function makeRequest(url: string, payload: Record<string, unknown>, method: "POST" | "PATCH") {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function buildSupabaseStub(initialRows: HelpTutorialRecord[] = []) {
  const rows = [...initialRows];

  return {
    rows,
    client: {
      from(table: string) {
        if (table !== "help_tutorials") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return {
          select() {
            const filters: Record<string, string> = {};
            return {
              eq(column: string, value: string) {
                filters[column] = value;
                return this;
              },
              limit: async () => ({
                data: rows.filter((row) =>
                  Object.entries(filters).every(([key, value]) => String(row[key as keyof HelpTutorialRecord]) === value)
                ),
                error: null,
              }),
              maybeSingle: async () => ({
                data:
                  rows.find((row) =>
                    Object.entries(filters).every(([key, value]) => String(row[key as keyof HelpTutorialRecord]) === value)
                  ) ?? null,
                error: null,
              }),
            };
          },
          insert(payload: Record<string, unknown>) {
            return {
              select() {
                return {
                  maybeSingle: async () => {
                    const row = {
                      id: `tutorial-${rows.length + 1}`,
                      created_at: "2026-03-26T10:00:00.000Z",
                      updated_at: "2026-03-26T10:00:00.000Z",
                      unpublished_at: null,
                      seo_title: null,
                      meta_description: null,
                      ...payload,
                    } as HelpTutorialRecord;
                    rows.push(row);
                    return { data: row, error: null };
                  },
                };
              },
            };
          },
          update(payload: Record<string, unknown>) {
            return {
              eq(_column: string, value: string) {
                return {
                  select() {
                    return {
                      maybeSingle: async () => {
                        const index = rows.findIndex((row) => row.id === value);
                        if (index === -1) return { data: null, error: null };
                        rows[index] = {
                          ...rows[index],
                          ...payload,
                          updated_at: "2026-03-26T11:00:00.000Z",
                        } as HelpTutorialRecord;
                        return { data: rows[index], error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

function buildDeps(rows: HelpTutorialRecord[] = [], overrides?: Partial<AdminHelpTutorialRouteDeps>) {
  const supabase = buildSupabaseStub(rows).client as never;

  const deps: AdminHelpTutorialRouteDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminHelpTutorialRouteDeps["requireRole"]>>,
    getFileHelpDocByRoleAndSlug: async () => null,
    ...overrides,
  };

  return { deps, supabase };
}

void test("admin tutorial create publishes a public tenant tutorial with parsed video support", async () => {
  const { deps } = buildDeps();

  const response = await postAdminHelpTutorialsResponse(
    makeRequest("http://localhost/api/admin/help/tutorials", {
      title: "Tenant shortlist tutorial",
      slug: "tenant-shortlist-tutorial",
      summary: "Show tenants how to save and manage shortlists.",
      seo_title: "Tenant shortlist tutorial | PropatyHub Help",
      meta_description: "Learn how tenants save, review, and share shortlisted homes on PropatyHub.",
      audience: "tenant",
      visibility: "public",
      status: "published",
      video_url: "https://youtu.be/_jWHH5MQMAk",
      body: "## What this covers\n\n- Saving\n- Reviewing\n- Sharing",
    }, "POST"),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.tutorial.status, "published");
  assert.equal(body.tutorial.visibility, "public");
  assert.equal(body.tutorial.created_by, "admin-1");
  assert.equal(body.tutorial.seo_title, "Tenant shortlist tutorial | PropatyHub Help");
  assert.match(String(body.tutorial.meta_description), /save, review, and share shortlisted homes/i);
  assert.ok(body.tutorial.published_at);
});

void test("admin tutorial create rejects invalid admin visibility combinations", async () => {
  const { deps } = buildDeps();

  const response = await postAdminHelpTutorialsResponse(
    makeRequest("http://localhost/api/admin/help/tutorials", {
      title: "Admin queue tutorial",
      slug: "admin-queue-tutorial",
      summary: "Operate the internal review queue safely and consistently.",
      audience: "admin",
      visibility: "public",
      status: "draft",
      body: "## What this covers\n\n- Review\n- Approvals\n- Escalation",
    }, "POST"),
    deps
  );

  assert.equal(response.status, 422);
});

void test("admin tutorial create preserves authz denial responses", async () => {
  const { deps } = buildDeps([], {
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<AdminHelpTutorialRouteDeps["requireRole"]>>,
  });

  const response = await postAdminHelpTutorialsResponse(
    makeRequest("http://localhost/api/admin/help/tutorials", {
      title: "Denied tutorial",
      slug: "denied-tutorial",
      summary: "This request should be denied.",
      audience: "tenant",
      visibility: "public",
      status: "draft",
      body: "## What this covers\n\n- Denial",
    }, "POST"),
    deps
  );

  assert.equal(response.status, 403);
});

void test("admin tutorial edit can unpublish a previously published tutorial", async () => {
  const existing: HelpTutorialRecord = {
    id: "tutorial-1",
    title: "Admin listings walkthrough",
    slug: "admin-listings-walkthrough",
    summary: "Run the internal listings registry safely.",
    seo_title: null,
    meta_description: null,
    audience: "admin",
    visibility: "internal",
    status: "published",
    video_url: "https://youtu.be/_jWHH5MQMAk",
    body: "## What this covers\n\n- Search\n- Filters\n- Bulk delete",
    created_by: "admin-1",
    updated_by: "admin-1",
    created_at: "2026-03-26T09:00:00.000Z",
    updated_at: "2026-03-26T09:00:00.000Z",
    published_at: "2026-03-26T09:30:00.000Z",
    unpublished_at: null,
  };
  const supabaseStub = buildSupabaseStub([existing]);
  const deps: AdminHelpTutorialRouteDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        supabase: supabaseStub.client as never,
        user: { id: "admin-2" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminHelpTutorialRouteDeps["requireRole"]>>,
    getFileHelpDocByRoleAndSlug: async () => null,
  };

  const response = await patchAdminHelpTutorialResponse(
    makeRequest("http://localhost/api/admin/help/tutorials/tutorial-1", {
      title: existing.title,
      slug: existing.slug,
      summary: existing.summary,
      audience: existing.audience,
      visibility: existing.visibility,
      status: "draft",
      video_url: existing.video_url,
      body: existing.body,
    }, "PATCH"),
    { params: Promise.resolve({ id: existing.id }) },
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.tutorial.status, "draft");
  assert.equal(body.tutorial.published_at, null);
  assert.ok(body.tutorial.unpublished_at);
});
