import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin support page renders support requests inbox section", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "support", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /AdminSupportRequestsInbox/);
  assert.match(source, /<AdminSupportRequestsInbox\s*\/>/);
});

void test("admin support inbox component includes table and drawer metadata view", () => {
  const componentPath = path.join(
    process.cwd(),
    "components",
    "admin",
    "AdminSupportRequestsInbox.tsx"
  );
  const source = fs.readFileSync(componentPath, "utf8");

  assert.match(source, /data-testid="admin-support-inbox"/);
  assert.match(source, /data-testid="admin-support-refresh"/);
  assert.match(source, /data-testid="admin-support-table"/);
  assert.match(source, /data-testid="admin-support-row"/);
  assert.match(source, /data-testid="admin-support-rows"/);
  assert.match(source, /data-testid="admin-support-drawer"/);
  assert.match(source, /AI transcript/);
  assert.match(source, /Metadata/);
});
