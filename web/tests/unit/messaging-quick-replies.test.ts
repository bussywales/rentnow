import test from "node:test";
import assert from "node:assert/strict";

import { applyQuickReply, QUICK_REPLIES } from "../../lib/messaging/quick-replies";

void test("applyQuickReply appends replies to existing draft", () => {
  const reply = QUICK_REPLIES[0];
  assert.equal(applyQuickReply("", reply), reply);
  assert.equal(applyQuickReply("Hello", reply), `Hello ${reply}`);
});
