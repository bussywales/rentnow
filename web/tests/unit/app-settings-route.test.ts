import test from "node:test";
import assert from "node:assert/strict";
import { patchSchema, validatePatchPayload } from "@/app/api/admin/app-settings/route";

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

void test("patchSchema accepts check-in badge payload", () => {
  const parsed = patchSchema.parse({
    key: "show_tenant_checkin_badge",
    value: { enabled: true },
  });
  assert.equal(parsed.key, "show_tenant_checkin_badge");
});

void test("patchSchema accepts require location pin payload", () => {
  const parsed = patchSchema.parse({
    key: "require_location_pin_for_publish",
    value: { enabled: true },
  });
  assert.equal(parsed.key, "require_location_pin_for_publish");
});

void test("patchSchema accepts agent storefront payload", () => {
  const parsed = patchSchema.parse({
    key: "agent_storefronts_enabled",
    value: { enabled: true },
  });
  assert.equal(parsed.key, "agent_storefronts_enabled");
});

void test("patchSchema accepts payg amount payload", () => {
  const parsed = patchSchema.parse({
    key: "payg_listing_fee_amount",
    value: { value: 2000 },
  });
  assert.equal(parsed.key, "payg_listing_fee_amount");
});

void test("patchSchema accepts trial credits payload", () => {
  const parsed = patchSchema.parse({
    key: "trial_listing_credits_agent",
    value: { value: 3 },
  });
  assert.equal(parsed.key, "trial_listing_credits_agent");
});

void test("validatePatchPayload rejects invalid keys", () => {
  const parsed = validatePatchPayload({ key: "not_a_key", value: { enabled: true } });
  assert.equal(parsed.ok, false);
});
