import test from "node:test";
import assert from "node:assert/strict";
import { getHostNavItems } from "../../lib/role-access";

void test("host nav includes saved searches for landlord", () => {
  const items = getHostNavItems("landlord");
  const saved = items.find((item) => item.label === "Saved searches");
  assert.ok(saved, "expected saved searches nav item");
  assert.equal(saved?.visible, true);
  const help = items.find((item) => item.label === "Help / Performance");
  assert.ok(help, "expected host performance help nav item");
  assert.equal(help?.visible, true);
});

void test("host nav includes saved searches for agent", () => {
  const items = getHostNavItems("agent");
  const saved = items.find((item) => item.label === "Saved searches");
  assert.ok(saved, "expected saved searches nav item");
  assert.equal(saved?.visible, true);
  const help = items.find((item) => item.label === "Help / Performance");
  assert.ok(help, "expected host performance help nav item");
  assert.equal(help?.visible, true);
});
