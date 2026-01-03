import test from "node:test";
import assert from "node:assert/strict";

import { formatRoleLabel, isAdminRole, normalizeRole, ROLE_VALUES } from "../../lib/roles";

void test("normalizeRole accepts known roles and rejects unknown values", () => {
  assert.equal(normalizeRole("tenant"), "tenant");
  assert.equal(normalizeRole(" LandLord "), "landlord");
  assert.equal(normalizeRole("ADMIN"), "admin");
  assert.equal(normalizeRole("unknown"), null);
  assert.equal(normalizeRole(null), null);
});

void test("formatRoleLabel returns a readable label or Incomplete", () => {
  assert.equal(formatRoleLabel("agent"), "Agent");
  assert.equal(formatRoleLabel("invalid"), "Incomplete");
});

void test("isAdminRole only returns true for admin", () => {
  assert.equal(isAdminRole("admin"), true);
  assert.equal(isAdminRole("tenant"), false);
  assert.equal(isAdminRole(undefined), false);
});

void test("ROLE_VALUES contains expected roles", () => {
  assert.deepEqual(ROLE_VALUES, ["tenant", "landlord", "agent", "admin"]);
});
