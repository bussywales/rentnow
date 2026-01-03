import test from "node:test";
import assert from "node:assert/strict";

import { getEmailDispatchGuard } from "../../lib/alerts/tenant-alerts";

void test("alert email guard returns 503 when Resend env missing", () => {
  const prevKey = process.env.RESEND_API_KEY;
  const prevFrom = process.env.RESEND_FROM;
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;

  try {
    const guard = getEmailDispatchGuard();
    assert.equal(guard.ok, false);
    assert.equal(guard.status, 503);
    assert.equal(guard.error, "Email not configured");
  } finally {
    if (prevKey) process.env.RESEND_API_KEY = prevKey;
    if (prevFrom) process.env.RESEND_FROM = prevFrom;
  }
});
