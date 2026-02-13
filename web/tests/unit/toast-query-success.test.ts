import test from "node:test";
import assert from "node:assert/strict";
import { canConsumeSuccessForPath, getToastPayloadFromQuery, removeSuccessFromQuery } from "@/lib/utils/toast";

test("success query resolves to toast payload", () => {
  const params = new URLSearchParams(
    "savedSearchId=abc123&source=saved-search&intent=all&success=Found+3+matches+for+Lagos"
  );
  const payload = getToastPayloadFromQuery(params);
  assert.ok(payload);
  assert.equal(payload?.variant, "success");
  assert.equal(payload?.message, "Found 3 matches for Lagos");
});

test("removeSuccessFromQuery strips success and keeps other params", () => {
  const params = new URLSearchParams(
    "savedSearchId=abc123&source=saved-search&intent=all&success=Found+3+matches+for+Lagos"
  );
  const cleaned = removeSuccessFromQuery(params);
  assert.equal(cleaned.get("success"), null);
  assert.equal(cleaned.get("savedSearchId"), "abc123");
  assert.equal(cleaned.get("source"), "saved-search");
  assert.equal(cleaned.get("intent"), "all");
});

test("success query is only consumed on allowlisted paths", () => {
  const params = new URLSearchParams("success=Saved");

  assert.equal(canConsumeSuccessForPath("/properties"), true);
  assert.equal(canConsumeSuccessForPath("/properties/123"), true);
  assert.equal(canConsumeSuccessForPath("/dashboard"), true);
  assert.equal(canConsumeSuccessForPath("/dashboard/listings"), true);
  assert.equal(canConsumeSuccessForPath("/tenant/home"), false);

  const blockedPayload = getToastPayloadFromQuery(params, { allowSuccess: false });
  assert.equal(blockedPayload, null);
});
