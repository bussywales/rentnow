import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  includeDemoListingsForViewer,
  normalizeDemoListingsVisibilityPolicy,
  shouldRenderDemoBadge,
  shouldRenderDemoWatermark,
} from "@/lib/properties/demo";

void test("demo listing visibility policy defaults to restricted", () => {
  assert.equal(normalizeDemoListingsVisibilityPolicy(undefined), "restricted");
  assert.equal(normalizeDemoListingsVisibilityPolicy(""), "restricted");
});

void test("restricted policy allows only admin, host roles, or listing owners", () => {
  assert.equal(
    includeDemoListingsForViewer({ viewerRole: null, policy: "restricted" }),
    false
  );
  assert.equal(
    includeDemoListingsForViewer({ viewerRole: "tenant", policy: "restricted" }),
    false
  );
  assert.equal(
    includeDemoListingsForViewer({ viewerRole: "admin", policy: "restricted" }),
    true
  );
  assert.equal(
    includeDemoListingsForViewer({ viewerRole: "agent", policy: "restricted" }),
    true
  );
  assert.equal(
    includeDemoListingsForViewer({
      viewerRole: "tenant",
      viewerId: "viewer-1",
      ownerId: "viewer-1",
      policy: "restricted",
    }),
    true
  );
});

void test("public policy exposes demo listings to everyone", () => {
  assert.equal(includeDemoListingsForViewer({ viewerRole: null, policy: "public" }), true);
  assert.equal(
    includeDemoListingsForViewer({ viewerRole: "tenant", policy: "public" }),
    true
  );
});

void test("demo badge and watermark rendering respects toggles", () => {
  assert.equal(shouldRenderDemoBadge({ isDemo: true, enabled: true }), true);
  assert.equal(shouldRenderDemoBadge({ isDemo: true, enabled: false }), false);
  assert.equal(shouldRenderDemoBadge({ isDemo: false, enabled: true }), false);

  assert.equal(shouldRenderDemoWatermark({ isDemo: true, enabled: true }), true);
  assert.equal(shouldRenderDemoWatermark({ isDemo: true, enabled: false }), false);
  assert.equal(shouldRenderDemoWatermark({ isDemo: false, enabled: true }), false);
});

void test("global styles can disable demo badge and watermark output", () => {
  const cssPath = path.join(process.cwd(), "app", "globals.css");
  const css = fs.readFileSync(cssPath, "utf8");

  assert.ok(
    css.includes('body[data-demo-badge-enabled="false"] .property-demo-badge'),
    "expected demo badge visibility toggle selector"
  );
  assert.ok(
    css.includes('body[data-demo-watermark-enabled="false"] .property-demo-watermark'),
    "expected demo watermark visibility toggle selector"
  );
});

void test("public browse and search queries apply demo filter guards", () => {
  const browseRoutePath = path.join(process.cwd(), "app", "api", "properties", "route.ts");
  const searchLibPath = path.join(process.cwd(), "lib", "search.ts");
  const shortletsSearchRoutePath = path.join(
    process.cwd(),
    "app",
    "api",
    "shortlets",
    "search",
    "route.ts"
  );
  const browseRoute = fs.readFileSync(browseRoutePath, "utf8");
  const searchLib = fs.readFileSync(searchLibPath, "utf8");
  const shortletsSearchRoute = fs.readFileSync(shortletsSearchRoutePath, "utf8");

  assert.ok(
    browseRoute.includes('.eq("is_demo", false)'),
    "expected /api/properties public query to filter out demo listings"
  );
  assert.ok(
    searchLib.includes('.eq("is_demo", false)'),
    "expected shared search query to filter out demo listings"
  );
  assert.ok(
    shortletsSearchRoute.includes("includeDemoListingsForViewer"),
    "expected /api/shortlets/search to derive includeDemo from policy-aware helper"
  );
  assert.ok(
    !shortletsSearchRoute.includes("includeDemo: false"),
    "expected /api/shortlets/search to avoid hardcoded demo exclusion"
  );
});
