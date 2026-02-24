import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("profile form renders private first and surname fields with non-public helper copy", () => {
  const filePath = path.join(process.cwd(), "components", "profile", "ProfileFormClient.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /First name \(private\)/);
  assert.match(source, /Surname \(private\)/);
  assert.match(source, /Used for support and account verification\. Not shown publicly\./);
});

void test("profile save payload persists private name fields", () => {
  const filePath = path.join(process.cwd(), "components", "profile", "ProfileFormClient.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /first_name:\s*firstName\.trim\(\)\s*\|\|\s*null/);
  assert.match(source, /last_name:\s*lastName\.trim\(\)\s*\|\|\s*null/);
});

void test("profile page and profile ensure helper select private name fields", () => {
  const pagePath = path.join(process.cwd(), "app", "profile", "page.tsx");
  const pageSource = fs.readFileSync(pagePath, "utf8");
  assert.match(pageSource, /first_name,\s*last_name/);

  const ensurePath = path.join(process.cwd(), "lib", "profile", "ensure-profile.ts");
  const ensureSource = fs.readFileSync(ensurePath, "utf8");
  assert.match(ensureSource, /first_name,\s*last_name/);
});
