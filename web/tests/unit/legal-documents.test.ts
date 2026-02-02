import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getRequiredLegalAudiences } from "@/lib/legal/requirements";
import { canEditLegalDocument } from "@/lib/legal/workflow";
import { renderLegalDocx, renderLegalPdf } from "@/lib/legal/export.server";

void test("required legal audiences include base docs per role", () => {
  assert.deepEqual(getRequiredLegalAudiences("tenant"), ["MASTER", "AUP", "TENANT"]);
  assert.deepEqual(getRequiredLegalAudiences("landlord"), ["MASTER", "AUP", "LANDLORD_AGENT"]);
  assert.deepEqual(getRequiredLegalAudiences("agent"), ["MASTER", "AUP", "LANDLORD_AGENT"]);
  assert.deepEqual(getRequiredLegalAudiences("admin"), ["MASTER", "AUP", "ADMIN_OPS"]);
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
