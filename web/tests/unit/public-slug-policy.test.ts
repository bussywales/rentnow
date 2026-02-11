import test from "node:test";
import assert from "node:assert/strict";
import {
  BLOCKED_PUBLIC_SLUGS,
  enforcePublicSlugCooldown,
  normalizePublicSlugInput,
  validatePublicSlugInput,
} from "@/lib/advertisers/public-slug-policy";

void test("normalizePublicSlugInput lowercases and trims", () => {
  assert.equal(normalizePublicSlugInput("  Xthetic-Studio  "), "xthetic-studio");
});

void test("validatePublicSlugInput blocks reserved words", () => {
  for (const blocked of BLOCKED_PUBLIC_SLUGS) {
    const result = validatePublicSlugInput(blocked);
    assert.equal(result.ok, false, `expected ${blocked} to be blocked`);
  }
});

void test("validatePublicSlugInput enforces format and length", () => {
  assert.equal(validatePublicSlugInput("ab").ok, false);
  assert.equal(validatePublicSlugInput("a".repeat(61)).ok, false);
  assert.equal(validatePublicSlugInput("x_the_tic").ok, false);
  assert.equal(validatePublicSlugInput("-xthetic").ok, false);
  assert.equal(validatePublicSlugInput("xthetic-").ok, false);
  assert.equal(validatePublicSlugInput("Xthetic").ok, false);
  assert.equal(validatePublicSlugInput("xthetic-studio").ok, true);
});

void test("enforcePublicSlugCooldown allows changes after seven days", () => {
  const now = new Date("2026-02-11T12:00:00.000Z");
  const stale = enforcePublicSlugCooldown({
    now,
    lastChangedAt: "2026-02-01T11:59:59.000Z",
  });
  assert.equal(stale.ok, true);

  const fresh = enforcePublicSlugCooldown({
    now,
    lastChangedAt: "2026-02-09T12:00:00.000Z",
  });
  assert.equal(fresh.ok, false);
  if (!fresh.ok) {
    assert.match(fresh.message, /once every 7 days/i);
  }
});
