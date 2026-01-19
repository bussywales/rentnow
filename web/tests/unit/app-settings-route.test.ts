import test from "node:test";
import assert from "node:assert/strict";
import { patchSchema } from "@/app/api/admin/app-settings/route";

void test("patchSchema rejects non-boolean enabled", () => {
  assert.throws(() =>
    patchSchema.parse({ key: "show_tenant_photo_trust_signals", value: { enabled: "yes" } })
  );
});

void test("patchSchema accepts correct payload", () => {
  const parsed = patchSchema.parse({
    key: "show_tenant_photo_trust_signals",
    value: { enabled: false },
  });
  assert.equal(parsed.value.enabled, false);
});

void test("patchSchema accepts location picker payload", () => {
  const parsed = patchSchema.parse({
    key: "enable_location_picker",
    value: { enabled: true },
  });
  assert.equal(parsed.key, "enable_location_picker");
});
