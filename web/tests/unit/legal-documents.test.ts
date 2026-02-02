import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getRequiredLegalAudiences } from "@/lib/legal/requirements";
import { canEditLegalDocument } from "@/lib/legal/workflow";
import { renderLegalDocx, renderLegalPdf } from "@/lib/legal/export.server";
import { postLegalAcceptResponse } from "@/app/api/legal/accept/route";
import { resolveJurisdiction } from "@/lib/legal/jurisdiction.server";
import { getPublicLegalDocuments } from "@/lib/legal/public-documents.server";
import { DEFAULT_JURISDICTION } from "@/lib/legal/constants";

type SupabaseStub = {
  from: (table: string) => {
    upsert: (payload: Record<string, unknown>[], options: { onConflict?: string }) => {
      then: (resolve: (value: { error: null }) => void) => void;
    };
  };
};

void test("required legal audiences include base docs per role", () => {
  assert.deepEqual(getRequiredLegalAudiences("tenant"), ["MASTER", "AUP", "TENANT"]);
  assert.deepEqual(getRequiredLegalAudiences("landlord"), ["MASTER", "AUP", "LANDLORD_AGENT"]);
  assert.deepEqual(getRequiredLegalAudiences("agent"), ["MASTER", "AUP", "LANDLORD_AGENT"]);
  assert.deepEqual(getRequiredLegalAudiences("admin"), ["MASTER", "AUP", "ADMIN_OPS"]);
  assert.deepEqual(getRequiredLegalAudiences(["admin", "tenant"]), [
    "MASTER",
    "AUP",
    "ADMIN_OPS",
    "TENANT",
  ]);
});

void test("published documents are immutable", () => {
  assert.equal(canEditLegalDocument("published"), false);
  assert.equal(canEditLegalDocument("draft"), true);
});

void test("exports reject empty content", async () => {
  const base = {
    title: "Test",
    version: 1,
    jurisdiction: "NG",
    audience: "MASTER" as const,
    content_md: "",
  };

  await assert.rejects(() => renderLegalPdf(base), /empty/i);
  await assert.rejects(() => renderLegalDocx(base), /empty/i);
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
      body: JSON.stringify({ jurisdiction: "NG" }),
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
        requiredAudiences: ["MASTER", "AUP", "ADMIN_OPS"],
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
        pendingAudiences: ["MASTER", "AUP", "ADMIN_OPS"],
        missingAudiences: [],
        isComplete: false,
      }),
    }
  );

  assert.equal(response.status, 200);
  assert.ok(upsertPayload);
  assert.equal(upsertPayload?.length, 3);
  assert.equal(upsertOnConflict, "user_id,jurisdiction,audience,version");
});

void test("missing audiences are surfaced in acceptance errors", async () => {
  const response = await postLegalAcceptResponse(
    new Request("http://localhost/api/legal/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jurisdiction: "NG" }),
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
        requiredAudiences: ["MASTER", "AUP", "TENANT"],
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
        missingAudiences: ["AUP", "TENANT"],
        isComplete: false,
      }),
    }
  );

  const body = await response.json();
  assert.equal(response.status, 409);
  assert.deepEqual(body.missing_audiences, ["AUP", "TENANT"]);
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
