import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("workspace shell persists collapse state and uses desktop push layout", () => {
  const filePath = path.join(process.cwd(), "components", "workspace", "WorkspaceShell.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /workspace:sidebar:collapsed:v1/);
  assert.match(source, /md:grid-cols-\[72px_minmax\(0,1fr\)\]/);
  assert.match(source, /md:grid-cols-\[256px_minmax\(0,1fr\)\]/);
  assert.match(source, /data-testid="workspace-shell-main"/);
  assert.match(source, /data-testid="workspace-shell-sidebar-region"/);
});

void test("workspace shell keeps mobile nav in drawer while desktop stays non-overlay", () => {
  const filePath = path.join(process.cwd(), "components", "workspace", "WorkspaceShell.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /data-testid="workspace-mobile-drawer"/);
  assert.match(source, /md:hidden/);
  assert.match(source, /hidden min-w-0 md:block/);
});
