import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildHostListingsRedirectHref } from "@/lib/routing/dashboard-properties-index-redirect";

void test("legacy dashboard properties route redirects to host listings and preserves query params", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "properties", "page.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /buildHostListingsRedirectHref/);
  assert.match(source, /redirect\(buildHostListingsRedirectHref\(resolved\)\)/);
});

void test("buildHostListingsRedirectHref preserves single and repeated query values", () => {
  const href = buildHostListingsRedirectHref({
    view: "all",
    status: ["live", "pending"],
    q: "ikeja",
  });

  assert.equal(href, "/host/listings?view=all&status=live&status=pending&q=ikeja");
});

void test("buildHostListingsRedirectHref drops empty values and falls back to canonical path", () => {
  const href = buildHostListingsRedirectHref({
    view: "",
    q: undefined,
    status: [""],
  });

  assert.equal(href, "/host/listings?view=manage");
});
