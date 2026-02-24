import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("/home routes tenant/admin away and keeps agent/landlord in workspace shell", () => {
  const filePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /if \(role === "tenant"\)/);
  assert.match(source, /redirect\("\/tenant\/home"\)/);
  assert.match(source, /if \(role === "admin"\)/);
  assert.match(source, /redirect\("\/admin"\)/);
  assert.match(source, /if \(role !== "agent" && role !== "landlord"\)/);
  assert.match(source, /<WorkspaceShell role=\{role\}/);
});
