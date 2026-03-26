import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { getHelpVisibilityModel } from "@/lib/help/visibility";

void test("public help model stays public for anonymous viewers", () => {
  const model = getHelpVisibilityModel(null);
  assert.deepEqual(model.publicRoles, ["tenant", "landlord", "agent"]);
  assert.deepEqual(model.internalRoles, []);
  assert.equal(model.showInternalAdminHelp, false);
});

void test("admin viewers get the internal help section in addition to public roles", () => {
  const model = getHelpVisibilityModel("admin");
  assert.deepEqual(model.publicRoles, ["tenant", "landlord", "agent"]);
  assert.deepEqual(model.internalRoles, ["admin"]);
  assert.equal(model.showInternalAdminHelp, true);
});

void test("admin help route layout keeps auth and role guards", () => {
  const contents = readFileSync("app/help/admin/layout.tsx", "utf8");
  assert.ok(contents.includes('/auth/required?redirect=/help/admin&reason=auth'));
  assert.ok(contents.includes('/forbidden?reason=role'));
  assert.ok(contents.includes("isAdminRole"));
});
