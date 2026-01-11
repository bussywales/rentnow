import test from "node:test";
import assert from "node:assert/strict";

import {
  buildShareToken,
  buildThreadId,
  getShareStatusCopy,
  isShareActive,
  resolveShareStatus,
} from "../../lib/messaging/share";

void test("buildShareToken returns url-safe token", () => {
  const token = buildShareToken();
  assert.ok(token.length >= 40);
  assert.ok(/^[A-Za-z0-9_-]+$/.test(token));
});

void test("buildThreadId returns a stable uuid format", () => {
  const first = buildThreadId("property-1", "tenant-1");
  const second = buildThreadId("property-1", "tenant-1");
  assert.equal(first, second);
  assert.ok(/^[0-9a-f-]{36}$/.test(first));
});

void test("isShareActive respects expiry and revoke", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(
    isShareActive({ expiresAt: "2026-01-02T00:00:00Z", now }),
    true
  );
  assert.equal(
    isShareActive({ expiresAt: "2025-12-31T23:59:00Z", now }),
    false
  );
  assert.equal(
    isShareActive({ expiresAt: "2026-01-02T00:00:00Z", revokedAt: "2025-12-31T10:00:00Z", now }),
    false
  );
});

void test("resolveShareStatus returns explicit states", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(resolveShareStatus(null, now), "invalid");
  assert.equal(
    resolveShareStatus({ expiresAt: "2025-12-31T10:00:00Z" }, now),
    "expired"
  );
  assert.equal(
    resolveShareStatus({ expiresAt: "2026-01-02T00:00:00Z", revokedAt: "2025-12-31T10:00:00Z" }, now),
    "revoked"
  );
  assert.equal(
    resolveShareStatus({ expiresAt: "2026-01-02T00:00:00Z" }, now),
    "active"
  );
});

void test("getShareStatusCopy returns expected CTAs", () => {
  assert.equal(getShareStatusCopy("revoked").cta?.href, "/dashboard/messages");
  assert.equal(getShareStatusCopy("expired").cta?.href, "/dashboard/messages");
  assert.equal(getShareStatusCopy("invalid").cta?.href, "/support");
});
