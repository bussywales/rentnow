import test from "node:test";
import assert from "node:assert/strict";
import { buildHostListingQualityTelemetrySnapshot } from "@/lib/properties/listing-quality-telemetry-report";

void test("host listing quality telemetry report aggregates usage, step clicks, and improvement", () => {
  const snapshot = buildHostListingQualityTelemetrySnapshot({
    now: new Date("2026-03-14T12:00:00.000Z"),
    rows: [
      {
        event_type: "listing_quality_guidance_viewed",
        occurred_at: "2026-03-13T10:00:00.000Z",
        meta: {
          source: "submit_step",
          best_next_fix_key: "missing_images",
          score_before: 45,
          missing_count_before: 4,
        },
      },
      {
        event_type: "listing_quality_guidance_viewed",
        occurred_at: "2026-03-13T11:00:00.000Z",
        meta: {
          source: "submit_step",
          best_next_fix_key: "missing_description",
          score_before: 55,
          missing_count_before: 3,
        },
      },
      {
        event_type: "listing_quality_fix_clicked",
        occurred_at: "2026-03-13T10:05:00.000Z",
        meta: {
          source: "submit_step",
          clicked_fix_key: "missing_images",
          target_step: "photos",
        },
      },
      {
        event_type: "listing_quality_fix_clicked",
        occurred_at: "2026-03-13T11:05:00.000Z",
        meta: {
          source: "submit_step",
          clicked_fix_key: "missing_description",
          target_step: "details",
        },
      },
      {
        event_type: "listing_submit_attempted",
        occurred_at: "2026-03-13T10:15:00.000Z",
        meta: {
          quality_source: "submit_step",
          quality_score_before: 45,
          quality_score_at_submit: 67,
          quality_score_improved: true,
          quality_missing_count_before: 4,
          quality_missing_count_at_submit: 2,
        },
      },
      {
        event_type: "listing_submit_attempted",
        occurred_at: "2026-03-13T11:15:00.000Z",
        meta: {
          quality_source: "submit_step",
          quality_score_before: 55,
          quality_score_at_submit: 50,
          quality_score_improved: false,
          quality_missing_count_before: 3,
          quality_missing_count_at_submit: 3,
        },
      },
    ],
  });

  assert.equal(snapshot.guidanceViewed, 2);
  assert.equal(snapshot.fixClicked, 2);
  assert.equal(snapshot.clickThroughRate, 100);
  assert.equal(snapshot.submitAttempted, 2);
  assert.equal(snapshot.improvedBeforeSubmit, 1);
  assert.equal(snapshot.improvementRate, 50);
  assert.equal(snapshot.averageScoreDelta, 8.5);
  assert.deepEqual(
    snapshot.byTargetStep.map((row) => [row.key, row.clicks]),
    [
      ["basics", 0],
      ["details", 1],
      ["photos", 1],
    ]
  );
});

void test("host listing quality telemetry report ignores submit attempts without quality telemetry", () => {
  const snapshot = buildHostListingQualityTelemetrySnapshot({
    rows: [
      {
        event_type: "listing_submit_attempted",
        occurred_at: "2026-03-13T10:15:00.000Z",
        meta: {},
      },
    ],
  });

  assert.equal(snapshot.submitAttempted, 0);
  assert.equal(snapshot.improvedBeforeSubmit, 0);
  assert.equal(snapshot.improvementRate, null);
  assert.equal(snapshot.averageScoreDelta, null);
});
