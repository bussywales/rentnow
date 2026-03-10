import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const shellNoSsrPath = path.join(
  process.cwd(),
  "components",
  "shortlets",
  "search",
  "ShortletsSearchShellNoSsr.tsx"
);
const navLinksPath = path.join(process.cwd(), "components", "layout", "NavLinksClient.tsx");

void test("shortlets shell no-ssr delegates directly to dynamic client shell", () => {
  const contents = fs.readFileSync(shellNoSsrPath, "utf8");

  assert.equal(contents.includes('import { useSyncExternalStore } from "react";'), false);
  assert.equal(contents.includes("const hasMounted = useSyncExternalStore("), false);
  assert.equal(contents.includes("if (!hasMounted) {"), false);
  assert.equal(contents.includes("return null;"), false);
  assert.ok(contents.includes("{ ssr: false }"));
  assert.ok(contents.includes("return <ShortletsSearchShellClient {...props} />;"));
});

void test("nav links defer pathname-dependent active state until after mount", () => {
  const contents = fs.readFileSync(navLinksPath, "utf8");

  assert.ok(contents.includes('import { useSyncExternalStore } from "react";'));
  assert.ok(contents.includes("const hasHydrated = useSyncExternalStore("));
  assert.ok(contents.includes("const activePathname = hasHydrated ? pathname ?? \"/\" : \"/\";"));
  assert.equal(contents.includes("return null;"), false);
  assert.ok(contents.includes("isActiveHref(activePathname, link.href)"));
});
