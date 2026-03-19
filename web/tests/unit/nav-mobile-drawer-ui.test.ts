import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("mobile drawer includes opaque backdrop and panel markers", () => {
  const filePath = path.join(process.cwd(), "components", "layout", "NavMobileDrawerClient.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(
    contents.includes('data-testid="mobile-drawer-overlay"'),
    "expected backdrop marker for mobile drawer"
  );
  assert.ok(
    contents.includes('data-testid="mobile-drawer-panel"'),
    "expected panel marker for mobile drawer"
  );
  assert.ok(
    contents.includes('data-testid="mobile-drawer-scroll"'),
    "expected scroll container marker"
  );
  assert.ok(
    contents.includes('data-testid="mobile-drawer-footer"'),
    "expected footer marker"
  );
  assert.ok(
    contents.includes('document.body.style.overflow = "hidden"'),
    "expected body scroll lock when drawer opens"
  );
  assert.ok(
    contents.includes("createPortal"),
    "expected drawer to render via createPortal"
  );
  assert.ok(contents.includes("h-[100dvh]"), "expected dvh height for drawer panel");
  assert.ok(contents.includes("overflow-y-auto"), "expected scrollable drawer content");
});

void test("mobile drawer external links open in a new tab and show an external icon", () => {
  const filePath = path.join(process.cwd(), "components", "layout", "NavMobileDrawerClient.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(
    contents.includes('target={link.external ? "_blank" : undefined}'),
    "expected external drawer links to open in a new tab"
  );
  assert.ok(
    contents.includes('rel={link.external ? "noreferrer noopener" : undefined}'),
    "expected external drawer links to use safe rel attributes"
  );
  assert.ok(
    contents.includes('data-testid={`${link.testId ?? "mobile-drawer-external"}-icon`}'),
    "expected external icon test id template"
  );
  assert.ok(
    contents.includes("Opens in a new tab"),
    "expected screen-reader hint for external drawer links"
  );
});
