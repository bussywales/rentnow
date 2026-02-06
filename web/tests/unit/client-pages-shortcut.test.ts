import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowClientPagesShortcut } from "../../lib/profile/client-pages-shortcut";

void test("client pages shortcut only shows for agents", () => {
  assert.equal(shouldShowClientPagesShortcut("agent"), true);
  assert.equal(shouldShowClientPagesShortcut("tenant"), false);
  assert.equal(shouldShowClientPagesShortcut("landlord"), false);
  assert.equal(shouldShowClientPagesShortcut("admin"), false);
  assert.equal(shouldShowClientPagesShortcut(null), false);
  assert.equal(shouldShowClientPagesShortcut(undefined), false);
});
