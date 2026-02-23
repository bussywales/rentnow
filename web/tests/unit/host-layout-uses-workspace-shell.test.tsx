import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host layout is wired to workspace shell with host badge props", () => {
  const filePath = path.join(process.cwd(), "app", "host", "layout.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /WorkspaceShell/);
  assert.match(source, /awaitingApprovalCount=\{hostAwaitingApprovalCount\}/);
  assert.match(source, /unreadMessages=\{unreadMessages\}/);
  assert.match(source, /title=\{workspaceTitle\}/);
});
