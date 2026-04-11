import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readAppFile(...parts: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

void test("host move ready surfaces carry pilot copy and help links", () => {
  const newPage = readAppFile("app", "host", "services", "new", "page.tsx");
  const listPage = readAppFile("app", "host", "services", "page.tsx");

  assert.ok(newPage.includes("Pilot active"));
  assert.ok(newPage.includes("Limited capacity"));
  assert.ok(newPage.includes('"/help/agent/services"'));
  assert.ok(newPage.includes("landlord, host, and agent"));

  assert.ok(listPage.includes("Pilot active"));
  assert.ok(listPage.includes("Limited capacity"));
  assert.ok(listPage.includes("operator follow-up"));
  assert.ok(listPage.includes("landlord, host, or agent portfolios"));
});

void test("admin services hub warns against scope creep and links to playbook", () => {
  const adminPage = readAppFile("app", "admin", "services", "page.tsx");
  assert.ok(adminPage.includes("Keep the wedge narrow until the pilot scorecard passes."));
  assert.ok(adminPage.includes("Pilot launch pack"));
  assert.ok(adminPage.includes("/help/admin/support-playbooks/move-ready-services"));
  assert.ok(adminPage.includes("/help/host/services"));
});
