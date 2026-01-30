import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("mobile drawer includes opaque backdrop and panel markers", () => {
  const filePath = path.join(process.cwd(), "components", "layout", "NavMobileDrawerClient.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(
    contents.includes('data-testid="mobile-drawer-backdrop"'),
    "expected backdrop marker for mobile drawer"
  );
  assert.ok(
    contents.includes('data-testid="mobile-drawer-panel"'),
    "expected panel marker for mobile drawer"
  );
  assert.ok(
    contents.includes('document.body.style.overflow = "hidden"'),
    "expected body scroll lock when drawer opens"
  );
});
