import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host properties manager route enforces role-safe access", () => {
  const filePath = path.join(process.cwd(), "app", "host", "properties", "page.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /resolveServerRole/);
  assert.match(source, /if \(!user\)/);
  assert.match(source, /redirect\("\/auth\/login\?reason=auth"\)/);
  assert.match(source, /if \(role === "tenant"\)/);
  assert.match(source, /redirect\("\/tenant\/home"\)/);
  assert.match(source, /role !== "landlord" && role !== "agent" && role !== "admin"/);
  assert.match(source, /<HostPropertiesManager listings=\{listings\} \/>/);
});

void test("host properties manager route uses host listing fetch pipeline", () => {
  const filePath = path.join(process.cwd(), "app", "host", "properties", "page.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /fetchOwnerListings/);
  assert.match(source, /computeDashboardListings/);
  assert.match(source, /hasActiveDelegation/);
  assert.match(source, /readActingAsFromCookies/);
});
