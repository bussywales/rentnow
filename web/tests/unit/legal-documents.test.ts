import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getRequiredLegalAudiences } from "@/lib/legal/requirements";
import { canEditLegalDocument } from "@/lib/legal/workflow";
import { renderLegalDocx, renderLegalPdf } from "@/lib/legal/export.server";
import { postLegalAcceptResponse } from "@/app/api/legal/accept/route";
import { getPublicLegalExportResponse } from "@/app/api/legal/documents/[id]/export/route";
import { resolveJurisdiction } from "@/lib/legal/jurisdiction.server";
import { getPublicLegalDocuments } from "@/lib/legal/public-documents.server";
import { DEFAULT_JURISDICTION } from "@/lib/legal/constants";
import { buildPublicLegalExportLinks } from "@/lib/legal/export-links";

type SupabaseStub = {
  from: (table: string) => {
    upsert: (payload: Record<string, unknown>[], options: { onConflict?: string }) => {
      then: (resolve: (value: { error: null }) => void) => void;
    };
  };
};

void test("required legal audiences include base docs per role", () => {
  assert.deepEqual(getRequiredLegalAudiences("tenant"), ["MASTER", "AUP", "DISCLAIMER", "TENANT"]);
  assert.deepEqual(getRequiredLegalAudiences("landlord"), [
    "MASTER",
    "AUP",
    "DISCLAIMER",
    "LANDLORD_AGENT",
  ]);
  assert.deepEqual(getRequiredLegalAudiences("agent"), [
    "MASTER",
    "AUP",
    "DISCLAIMER",
    "LANDLORD_AGENT",
  ]);
  assert.deepEqual(getRequiredLegalAudiences("admin"), [
    "MASTER",
    "AUP",
    "DISCLAIMER",
    "ADMIN_OPS",
  ]);
  assert.deepEqual(getRequiredLegalAudiences(["admin", "tenant"]), [
    "MASTER",
    "AUP",
    "DISCLAIMER",
    "ADMIN_OPS",
    "TENANT",
  ]);
});

void test("published documents are immutable", () => {
  assert.equal(canEditLegalDocument("published"), false);
  assert.equal(canEditLegalDocument("draft"), true);
});

void test("docx export rejects empty content", async () => {
  const base = {
    title: "Test",
    version: 1,
    jurisdiction: "NG",
    audience: "MASTER" as const,
    content_md: "",
  };

  await assert.rejects(() => renderLegalDocx(base), /empty/i);
});

void test("pdf export returns a buffer for empty content", async () => {
  const buffer = await renderLegalPdf({
    title: "Test",
    version: 1,
    jurisdiction: "NG",
    audience: "MASTER",
    content_md: "",
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 0);
});

void test("pdf export returns a buffer for non-empty content", async () => {
  const buffer = await renderLegalPdf({
    title: "Test",
    version: 2,
    jurisdiction: "NG",
    audience: "MASTER",
    content_md: "# Heading\n\nThis is a test paragraph with a [link](https://example.com).",
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 0);
});

void test("pdf export sanitizes unicode punctuation", async () => {
  const buffer = await renderLegalPdf({
    title: "Test ⸻ Export",
    version: 3,
    jurisdiction: "NG",
    audience: "MASTER",
    content_md: "Section ⸻ with unicode punctuation should still render.",
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 0);
});

void test("legal acceptance inserts rows for required documents", async () => {
  let upsertPayload: Record<string, unknown>[] | null = null;
  let upsertOnConflict: string | null = null;

  const supabase: SupabaseStub = {
    from: (table: string) => {
      assert.equal(table, "legal_acceptances");
      return {
        upsert: (payload: Record<string, unknown>[], options: { onConflict?: string }) => {
          upsertPayload = payload;
          upsertOnConflict = options.onConflict ?? null;
          return {
            then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
          };
        },
      };
    },
  };

  const response = await postLegalAcceptResponse(
    new Request("http://localhost/api/legal/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jurisdiction: "NG",
        accept_terms: true,
        accept_disclaimer: true,
      }),
    }),
    {
      hasServerSupabaseEnv: () => true,
      requireUser: async () =>
        ({ ok: true, user: { id: "user-1" }, supabase } as never),
      getUserRole: async () => "admin",
      getLegalAcceptanceStatus: async () => ({
        jurisdiction: "NG",
        role: "admin",
        roles: ["admin"],
        requiredAudiences: ["MASTER", "AUP", "DISCLAIMER", "ADMIN_OPS"],
        documents: [
          {
            id: "doc-1",
            jurisdiction: "NG",
            audience: "MASTER",
            version: 1,
            status: "published",
            title: "Master",
            content_md: "Terms",
          },
          {
            id: "doc-2",
            jurisdiction: "NG",
            audience: "AUP",
            version: 1,
            status: "published",
            title: "AUP",
            content_md: "Terms",
          },
          {
            id: "doc-4",
            jurisdiction: "NG",
            audience: "DISCLAIMER",
            version: 1,
            status: "published",
            title: "Disclaimer",
            content_md: "Terms",
          },
          {
            id: "doc-3",
            jurisdiction: "NG",
            audience: "ADMIN_OPS",
            version: 1,
            status: "published",
            title: "Admin",
            content_md: "Terms",
          },
        ],
        acceptedAudiences: [],
        pendingAudiences: ["MASTER", "AUP", "DISCLAIMER", "ADMIN_OPS"],
        missingAudiences: [],
        isComplete: false,
      }),
    }
  );

  assert.equal(response.status, 200);
  assert.ok(upsertPayload);
  assert.equal(upsertPayload?.length, 4);
  assert.equal(upsertOnConflict, "user_id,jurisdiction,audience,version");
});

void test("missing audiences are surfaced in acceptance errors", async () => {
  const response = await postLegalAcceptResponse(
    new Request("http://localhost/api/legal/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jurisdiction: "NG",
        accept_terms: true,
        accept_disclaimer: true,
      }),
    }),
    {
      hasServerSupabaseEnv: () => true,
      requireUser: async () =>
        ({ ok: true, user: { id: "user-2" }, supabase: {} } as never),
      getUserRole: async () => "tenant",
      getLegalAcceptanceStatus: async () => ({
        jurisdiction: "NG",
        role: "tenant",
        roles: ["tenant"],
        requiredAudiences: ["MASTER", "AUP", "DISCLAIMER", "TENANT"],
        documents: [
          {
            id: "doc-1",
            jurisdiction: "NG",
            audience: "MASTER",
            version: 1,
            status: "published",
            title: "Master",
            content_md: "Terms",
          },
        ],
        acceptedAudiences: [],
        pendingAudiences: ["MASTER"],
        missingAudiences: ["AUP", "DISCLAIMER", "TENANT"],
        isComplete: false,
      }),
    }
  );

  const body = await response.json();
  assert.equal(response.status, 409);
  assert.deepEqual(body.missing_audiences, ["AUP", "DISCLAIMER", "TENANT"]);
});

void test("legal migration enforces published uniqueness and acceptance uniqueness", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260202100000_legal_documents_and_acceptances.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    contents.includes("legal_documents_published_unique"),
    "expected partial unique index for published legal docs"
  );
  assert.ok(
    contents.includes("where status = 'published'"),
    "expected published-only uniqueness clause"
  );
  assert.ok(
    contents.includes("legal_acceptances_unique_user_doc"),
    "expected acceptance uniqueness constraint"
  );
});

void test("public legal page selects latest published documents for NG", async () => {
  const docs = [
    {
      id: "doc-1",
      jurisdiction: "NG",
      audience: "MASTER",
      version: 2,
      status: "published",
      title: "Master v2",
      effective_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "doc-2",
      jurisdiction: "NG",
      audience: "MASTER",
      version: 1,
      status: "published",
      title: "Master v1",
      effective_at: "2025-01-01T00:00:00.000Z",
    },
    {
      id: "doc-3",
      jurisdiction: "NG",
      audience: "AUP",
      version: 1,
      status: "published",
      title: "AUP v1",
      effective_at: "2026-01-01T00:00:00.000Z",
    },
  ];

  const result = await getPublicLegalDocuments({
    jurisdiction: "NG",
    fetchPublishedDocs: async () => ({ data: docs, error: null }),
  });

  assert.equal(result.length, 2);
  assert.equal(
    result.find((doc) => doc.audience === "MASTER")?.version,
    2
  );
});

void test("public legal page uses public export links", () => {
  const links = buildPublicLegalExportLinks("doc-123");
  assert.ok(links.pdfView.includes("/api/legal/documents/doc-123/export"));
  assert.ok(!links.pdfView.includes("/api/admin"));
  assert.ok(links.pdfDownload.includes("/api/legal/documents/doc-123/export"));
  assert.ok(links.docxDownload.includes("/api/legal/documents/doc-123/export"));
});

void test("public legal export returns PDF for published effective documents", async () => {
  const response = await getPublicLegalExportResponse(
    new Request(
      "http://localhost/api/legal/documents/doc-1/export?format=pdf&disposition=inline"
    ),
    { params: Promise.resolve({ id: "doc-1" }) },
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({} as never),
      renderLegalPdf: async () => Buffer.from("pdf"),
      renderLegalDocx: async () => Buffer.from("docx"),
      fetchLegalDocument: async () => ({
        data: {
          id: "doc-1",
          jurisdiction: "NG",
          audience: "MASTER",
          version: 1,
          status: "published",
          title: "Master",
          content_md: "Terms",
          effective_at: new Date(Date.now() - 1_000).toISOString(),
        },
        error: null,
      }),
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/pdf");
  assert.ok(response.headers.get("Content-Disposition")?.startsWith("inline"));
});

void test("public legal export returns 404 for draft documents", async () => {
  const response = await getPublicLegalExportResponse(
    new Request("http://localhost/api/legal/documents/doc-2/export?format=pdf"),
    { params: Promise.resolve({ id: "doc-2" }) },
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({} as never),
      renderLegalPdf: async () => Buffer.from("pdf"),
      renderLegalDocx: async () => Buffer.from("docx"),
      fetchLegalDocument: async () => ({
        data: {
          id: "doc-2",
          jurisdiction: "NG",
          audience: "MASTER",
          version: 1,
          status: "draft",
          title: "Draft",
          content_md: "Terms",
          effective_at: new Date().toISOString(),
        },
        error: null,
      }),
    }
  );

  assert.equal(response.status, 404);
});

void test("public legal export returns 404 for archived documents", async () => {
  const response = await getPublicLegalExportResponse(
    new Request("http://localhost/api/legal/documents/doc-4/export?format=pdf"),
    { params: Promise.resolve({ id: "doc-4" }) },
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({} as never),
      renderLegalPdf: async () => Buffer.from("pdf"),
      renderLegalDocx: async () => Buffer.from("docx"),
      fetchLegalDocument: async () => ({
        data: {
          id: "doc-4",
          jurisdiction: "NG",
          audience: "MASTER",
          version: 1,
          status: "archived",
          title: "Archived",
          content_md: "Terms",
          effective_at: new Date().toISOString(),
        },
        error: null,
      }),
    }
  );

  assert.equal(response.status, 404);
});

void test("public legal export returns 404 for not-effective documents", async () => {
  const response = await getPublicLegalExportResponse(
    new Request("http://localhost/api/legal/documents/doc-3/export?format=pdf"),
    { params: Promise.resolve({ id: "doc-3" }) },
    {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => ({} as never),
      renderLegalPdf: async () => Buffer.from("pdf"),
      renderLegalDocx: async () => Buffer.from("docx"),
      fetchLegalDocument: async () => ({
        data: {
          id: "doc-3",
          jurisdiction: "NG",
          audience: "MASTER",
          version: 1,
          status: "published",
          title: "Future",
          content_md: "Terms",
          effective_at: "2099-01-01T00:00:00.000Z",
        },
        error: null,
      }),
    }
  );

  assert.equal(response.status, 404);
});

void test("resolveJurisdiction falls back to app setting then default", async () => {
  const fromSetting = await resolveJurisdiction(
    {},
    { getAppSettingString: async () => "GH" }
  );
  assert.equal(fromSetting, "GH");

  const fromDefault = await resolveJurisdiction(
    {},
    { getAppSettingString: async () => "" }
  );
  assert.equal(fromDefault, DEFAULT_JURISDICTION);
});

void test("anon read policy allows published legal docs", () => {
  const policyPath = path.join(process.cwd(), "supabase", "rls_policies.sql");
  const contents = fs.readFileSync(policyPath, "utf8");
  assert.ok(
    contents.includes('CREATE POLICY "legal documents published read"'),
    "expected legal documents published read policy"
  );
  assert.ok(
    contents.includes("TO authenticated, anon"),
    "expected anon access in legal documents published read policy"
  );
  assert.ok(
    contents.includes("status = 'published'"),
    "expected published status guard in legal documents policy"
  );
});

void test("legal acceptances update policy allows self updates", () => {
  const policyPath = path.join(process.cwd(), "supabase", "rls_policies.sql");
  const contents = fs.readFileSync(policyPath, "utf8");

  assert.ok(
    contents.includes('CREATE POLICY "legal acceptances update self"'),
    "expected legal acceptances update policy"
  );
  assert.ok(
    contents.includes("FOR UPDATE"),
    "expected update policy for legal acceptances"
  );
});
