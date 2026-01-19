import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("dashboard route redirects by role", () => {
  const pagePath = path.join(process.cwd(), "app", "dashboard", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes('redirect("/tenant")'),
    "expected tenant redirect"
  );
  assert.ok(
    contents.includes('redirect("/host")'),
    "expected host redirect"
  );
  assert.ok(
    contents.includes('redirect("/admin")'),
    "expected admin redirect to admin console"
  );
});

void test("tenant workspace renders tenant-focused panels", () => {
  const pagePath = path.join(process.cwd(), "app", "tenant", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("Tenant workspace"),
    "expected tenant workspace heading"
  );
  assert.ok(
    contents.includes("Saved searches"),
    "expected saved searches panel"
  );
  assert.ok(
    contents.includes("Messages"),
    "expected messages panel"
  );
  assert.ok(
    contents.includes("Viewings"),
    "expected viewings panel"
  );
  assert.ok(
    !contents.includes("New listing"),
    "did not expect listing CTA copy"
  );
});

void test("host workspace redirects tenants and admins", () => {
  const pagePath = path.join(process.cwd(), "app", "host", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes('redirect("/tenant")'),
    "expected tenant redirect from host workspace"
  );
  assert.ok(
    contents.includes('redirect("/admin/support")'),
    "expected admin redirect from host workspace"
  );
});

void test("tenant workspace redirects non-tenant roles", () => {
  const pagePath = path.join(process.cwd(), "app", "tenant", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes('"/host"'),
    "expected host redirect fallback"
  );
  assert.ok(
    contents.includes('"/admin/support"'),
    "expected admin redirect fallback"
  );
});
