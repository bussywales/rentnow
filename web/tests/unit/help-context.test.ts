import test from "node:test";
import assert from "node:assert/strict";
import { getRelatedHelpLinks, resolveHelpContext } from "@/lib/help/help-context";

void test("resolveHelpContext maps major routes to expected role and slug", () => {
  assert.deepEqual(resolveHelpContext({ pathname: "/properties", role: "tenant" }), {
    role: "tenant",
    slug: "core-workflows",
    section: "Search and filters",
  });

  assert.deepEqual(resolveHelpContext({ pathname: "/tenant/home", role: "tenant" }), {
    role: "tenant",
    slug: "getting-started",
    section: "Tenant home",
  });

  assert.deepEqual(resolveHelpContext({ pathname: "/host", role: "landlord" }), {
    role: "landlord",
    slug: "getting-started",
    section: "Host workspace",
  });

  assert.deepEqual(resolveHelpContext({ pathname: "/host", role: "agent" }), {
    role: "agent",
    slug: "getting-started",
    section: "Host workspace",
  });

  assert.deepEqual(resolveHelpContext({ pathname: "/admin/alerts", role: "admin" }), {
    role: "admin",
    slug: "ops",
    section: "Alerts operations",
  });

  assert.deepEqual(resolveHelpContext({ pathname: "/admin/payments", role: "admin" }), {
    role: "admin",
    slug: "ops",
    section: "Payments operations",
  });
});

void test("resolveHelpContext falls back to role index defaults", () => {
  assert.deepEqual(resolveHelpContext({ pathname: "/unknown-route", role: "tenant" }), {
    role: "tenant",
    slug: "getting-started",
    section: "Help overview",
  });

  assert.deepEqual(resolveHelpContext({ pathname: "/unknown-route", role: "admin" }), {
    role: "admin",
    slug: "getting-started",
    section: "Help overview",
  });
});

void test("getRelatedHelpLinks excludes current slug and limits to four", () => {
  const links = getRelatedHelpLinks({ role: "tenant", currentSlug: "getting-started" });
  assert.ok(links.length <= 4);
  assert.equal(links.some((item) => item.slug === "getting-started"), false);
});
