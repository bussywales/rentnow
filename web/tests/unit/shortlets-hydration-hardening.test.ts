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

void test("shortlets shell no-ssr keeps the fallback tree through the first client render", () => {
  const contents = fs.readFileSync(shellNoSsrPath, "utf8");

  assert.ok(contents.includes('import { useSyncExternalStore } from "react";'));
  assert.ok(contents.includes("let hasMountedSnapshot = false;"));
  assert.ok(contents.includes("const mountListeners = new Set<() => void>();"));
  assert.ok(contents.includes("window.requestAnimationFrame(() => {"));
  assert.ok(contents.includes("window.cancelAnimationFrame(rafHandle);"));
  assert.equal(contents.includes("queueMicrotask(flushMountedSnapshot);"), false);
  assert.equal(contents.includes("const [hasMounted, setHasMounted] = useState(false);"), false);
  assert.equal(contents.includes("return null;"), false);
  assert.ok(contents.includes("function ShortletsSearchShellFallback()"));
  assert.ok(contents.includes('data-testid="shortlets-search-shell"'));
  assert.ok(contents.includes('data-testid="shortlets-shell-background"'));
  assert.match(contents, /ssr:\s*false/);
  assert.match(contents, /loading:\s*ShortletsSearchShellFallback/);
  assert.ok(contents.includes("const hasMounted = useSyncExternalStore("));
  assert.ok(contents.includes("return <ShortletsSearchShellFallback />;"));
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
