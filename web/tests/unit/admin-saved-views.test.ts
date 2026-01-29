import test from "node:test";
import assert from "node:assert/strict";
import { adminSavedViewSchema, normalizeSavedViewPayload } from "@/lib/admin/admin-saved-views";

test("admin saved view schema accepts valid payload", () => {
  const parsed = adminSavedViewSchema.safeParse({
    name: "Needs photos",
    route: "/admin/listings",
    query: { missingPhotos: "true", status: ["pending", "changes_requested"] },
  });
  assert.equal(parsed.success, true);
});

test("normalizeSavedViewPayload prioritizes query_json", () => {
  const payload = adminSavedViewSchema.parse({
    name: "My view",
    route: "/admin/listings",
    query: { status: "pending" },
    query_json: { status: ["live"] },
  });
  const normalized = normalizeSavedViewPayload(payload);
  assert.deepEqual(normalized.query_json, { status: ["live"] });
  assert.equal(normalized.name, "My view");
});
