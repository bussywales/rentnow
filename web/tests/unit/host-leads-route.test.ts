import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host leads route renders lead inbox and enforces host-role access", () => {
  const filePath = path.join(process.cwd(), "app", "host", "leads", "page.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /LeadInboxClient/);
  assert.match(source, /role !== "landlord" && role !== "agent" && role !== "admin"/);
  assert.match(source, /if \(role === "tenant"\)/);
  assert.match(source, /redirect\("\/tenant\/home"\)/);
});
