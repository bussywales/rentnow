import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("profile workspace routes use shared shell for agent and landlord roles", () => {
  const filePath = path.join(process.cwd(), "app", "profile", "layout.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /WorkspaceShell/);
  assert.match(source, /normalizedRole === "agent"/);
  assert.match(source, /normalizedRole === "landlord"/);
  assert.match(source, /if \(!shouldUseWorkspaceShell\)/);
});

void test("account workspace routes use shared shell for agent and landlord roles", () => {
  const filePath = path.join(process.cwd(), "app", "account", "layout.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /WorkspaceShell/);
  assert.match(source, /normalizedRole === "agent"/);
  assert.match(source, /normalizedRole === "landlord"/);
  assert.match(source, /if \(!shouldUseWorkspaceShell\)/);
});

void test("tenant routes bypass profile and account workspace shell wrappers", () => {
  const profileLayout = fs.readFileSync(
    path.join(process.cwd(), "app", "profile", "layout.tsx"),
    "utf8"
  );
  const accountLayout = fs.readFileSync(
    path.join(process.cwd(), "app", "account", "layout.tsx"),
    "utf8"
  );

  assert.match(profileLayout, /if \(!shouldUseWorkspaceShell\)/);
  assert.match(accountLayout, /if \(!shouldUseWorkspaceShell\)/);
  assert.match(profileLayout, /return <>\{children\}<\/>;/);
  assert.match(accountLayout, /return <>\{children\}<\/>;/);
});
