import test from "node:test";
import assert from "node:assert/strict";

import { buildDraftStorageKey, shouldPersistDraft } from "../../lib/messaging/drafts";

void test("buildDraftStorageKey uses the required prefix", () => {
  const key = buildDraftStorageKey("thread-123");
  assert.equal(key, "rentnow:msg:draft:thread-123");
});

void test("shouldPersistDraft matches non-empty drafts", () => {
  assert.equal(shouldPersistDraft(""), false);
  assert.equal(shouldPersistDraft("   "), false);
  assert.equal(shouldPersistDraft("Hello"), true);
});
