import test from "node:test";
import assert from "node:assert/strict";

import { MAIN_NAV_LINKS } from "@/components/layout/MainNav";
import { resolveNavLinks } from "@/components/layout/NavLinksClient";

test("admin nav shows Admin Home and hides Dashboard", () => {
  const links = resolveNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "admin" });
  const labels = links.map((link) => link.label);
  assert.ok(labels.includes("Admin Home"));
  assert.ok(!labels.includes("Dashboard"));
});

test("non-admin nav keeps Dashboard", () => {
  const links = resolveNavLinks(MAIN_NAV_LINKS, { isAuthed: true, role: "landlord" });
  const labels = links.map((link) => link.label);
  assert.ok(labels.includes("Dashboard"));
});
