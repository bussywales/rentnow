import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLeadProgressionSummary,
  mergeLeadContactExchangeFlags,
  resolveLeadProgressionSignals,
} from "@/lib/leads/progression";

void test("contact exchange flags accumulate handoff attempts and moderation detail", () => {
  const merged = mergeLeadContactExchangeFlags({
    existing: {
      handoff: {
        attempted: true,
        attempted_at: "2026-03-01T10:00:00.000Z",
        channels: ["phone"],
        phrases: ["call me"],
        count: 1,
      },
    },
    moderationMeta: {
      redacted: true,
      types: ["email"],
      counts: { email: 1, phone: 0 },
      phrases: ["email me"],
    },
    occurredAt: "2026-03-02T12:00:00.000Z",
  });

  assert.deepEqual(merged, {
    moderation: {
      redacted: true,
      types: ["email"],
      counts: { email: 1, phone: 0 },
      phrases: ["email me"],
    },
    handoff: {
      attempted: true,
      attempted_at: "2026-03-02T12:00:00.000Z",
      channels: ["phone", "email"],
      phrases: ["call me", "email me"],
      count: 2,
    },
  });
});

void test("lead progression signals reflect reply, viewing, and off-platform milestones", () => {
  const signals = resolveLeadProgressionSignals({
    repliedAt: "2026-03-10T10:00:00.000Z",
    viewingRequestedAt: "2026-03-11T10:00:00.000Z",
    viewingConfirmedAt: "2026-03-12T10:00:00.000Z",
    offPlatformHandoffAt: "2026-03-13T10:00:00.000Z",
    contactExchangeFlags: null,
  });

  assert.deepEqual(
    signals.map((signal) => signal.key),
    ["replied", "viewing_requested", "viewing_confirmed", "off_platform"]
  );
  assert.equal(signals.find((signal) => signal.key === "off_platform")?.tone, "warning");
});

void test("lead progression summary counts reply, viewing, and off-platform milestones honestly", () => {
  const summary = buildLeadProgressionSummary([
    {
      repliedAt: null,
      viewingRequestedAt: null,
      viewingConfirmedAt: null,
      offPlatformHandoffAt: null,
      contactExchangeFlags: null,
    },
    {
      repliedAt: "2026-03-10T10:00:00.000Z",
      viewingRequestedAt: "2026-03-11T10:00:00.000Z",
      viewingConfirmedAt: null,
      offPlatformHandoffAt: "2026-03-12T10:00:00.000Z",
      contactExchangeFlags: null,
    },
    {
      repliedAt: "2026-03-13T10:00:00.000Z",
      viewingRequestedAt: "2026-03-14T10:00:00.000Z",
      viewingConfirmedAt: "2026-03-15T10:00:00.000Z",
      offPlatformHandoffAt: null,
      contactExchangeFlags: null,
    },
  ]);

  assert.deepEqual(summary, {
    totalEnquiries: 3,
    awaitingReplyCount: 1,
    repliedCount: 2,
    viewingRequestedCount: 2,
    viewingConfirmedCount: 1,
    offPlatformCount: 1,
    replyRate: 67,
    viewingConfirmRate: 33,
  });
});
