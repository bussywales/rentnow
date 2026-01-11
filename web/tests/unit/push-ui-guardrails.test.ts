import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("saved searches page includes push unavailable guidance", () => {
  const pagePath = path.join(
    process.cwd(),
    "app",
    "dashboard",
    "saved-searches",
    "page.tsx"
  );
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("Notifications currently unavailable"),
    "expected saved searches to render push unavailable copy"
  );
});

void test("push status badge exposes enable and finish setup CTAs", () => {
  const badgePath = path.join(
    process.cwd(),
    "components",
    "dashboard",
    "PushStatusBadge.tsx"
  );
  const contents = fs.readFileSync(badgePath, "utf8");

  assert.ok(
    contents.includes("Enable notifications"),
    "expected enable notifications CTA"
  );
  assert.ok(
    contents.includes("Finish setup"),
    "expected finish setup CTA for re-enable state"
  );
});

void test("admin support push section exposes missing key label", () => {
  const pagePath = path.join(
    process.cwd(),
    "app",
    "admin",
    "support",
    "page.tsx"
  );
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("Missing keys:"),
    "expected admin support to show missing key label when enabled"
  );
});
