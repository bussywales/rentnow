import test from "node:test";
import assert from "node:assert/strict";

import {
  buildThrottleTelemetryRow,
  recordThrottleTelemetryEvent,
} from "../../lib/messaging/throttle-telemetry";
import { buildThrottleTelemetrySummary } from "../../lib/admin/messaging-throttle";

void test("telemetry insert is attempted for rate-limited sends", async () => {
  const inserted: unknown[] = [];
  const client = {
    from: () => ({
      insert: async (payload: unknown) => {
        inserted.push(payload);
        return { error: null };
      },
    }),
  };

  const row = buildThrottleTelemetryRow({
    actorProfileId: "user-1",
    threadKey: "property-1:host-1",
    propertyId: "property-1",
    recipientProfileId: "host-1",
    retryAfterSeconds: 12,
    windowSeconds: 60,
    limit: 6,
    mode: "send_message",
  });

  const result = await recordThrottleTelemetryEvent({
    client,
    code: "rate_limited",
    row,
  });

  assert.equal(result.ok, true);
  assert.equal(inserted.length, 1);
  assert.deepEqual(inserted[0], row);
});

void test("telemetry insert is skipped for non-rate-limited sends", async () => {
  let inserted = false;
  const client = {
    from: () => ({
      insert: async () => {
        inserted = true;
        return { error: null };
      },
    }),
  };

  const row = buildThrottleTelemetryRow({
    actorProfileId: "user-1",
    threadKey: "property-1:host-1",
  });

  const result = await recordThrottleTelemetryEvent({
    client,
    code: "unknown",
    row,
  });

  assert.equal(result.skipped, true);
  assert.equal(inserted, false);
});

void test("throttle telemetry summary aggregates counts", () => {
  const summary = buildThrottleTelemetrySummary([
    { actor_profile_id: "user-1", thread_key: "thread-1" },
    { actor_profile_id: "user-1", thread_key: "thread-2" },
    { actor_profile_id: "user-2", thread_key: "thread-1" },
  ]);

  assert.equal(summary.sampleSize, 3);
  assert.equal(summary.topSenders[0]?.key, "user-1");
  assert.equal(summary.topSenders[0]?.count, 2);
  assert.equal(summary.topThreads[0]?.key, "thread-1");
  assert.equal(summary.topThreads[0]?.count, 2);
});
