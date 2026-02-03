import assert from "node:assert";
import path from "node:path";
import fs from "node:fs";
import test from "node:test";
import {
  buildPropertyEventSummary,
  estimateMissedDemand,
  type PropertyEventRow,
} from "@/lib/analytics/property-events";

void test("property_events migration includes dedupe + cap logic", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260203210000_property_events.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    contents.includes("property_events_event_type_check"),
    "expected event_type constraint"
  );
  assert.ok(
    contents.includes("event_type = 'property_view'") && contents.includes("occurred_at::date"),
    "expected property_view dedupe by day"
  );
  assert.ok(
    contents.includes("featured_impression") && contents.includes("daily_cap"),
    "expected featured impression cap"
  );
});

void test("buildPropertyEventSummary aggregates metrics and attribution", () => {
  const rows: PropertyEventRow[] = [
    {
      property_id: "prop-1",
      event_type: "property_view",
      session_key: "sess-a",
      occurred_at: "2026-02-03T10:00:00Z",
      meta: { source: "featured" },
    },
    {
      property_id: "prop-1",
      event_type: "property_view",
      session_key: "sess-a",
      occurred_at: "2026-02-03T10:05:00Z",
    },
    {
      property_id: "prop-1",
      event_type: "save_toggle",
      session_key: "sess-a",
      occurred_at: "2026-02-03T10:10:00Z",
      meta: { action: "save" },
    },
    {
      property_id: "prop-1",
      event_type: "lead_created",
      session_key: "sess-a",
      occurred_at: "2026-02-03T10:20:00Z",
    },
    {
      property_id: "prop-1",
      event_type: "viewing_requested",
      session_key: "sess-b",
      occurred_at: "2026-02-03T11:00:00Z",
    },
    {
      property_id: "prop-1",
      event_type: "featured_impression",
      session_key: "sess-a",
      occurred_at: "2026-02-03T09:55:00Z",
    },
  ];

  const summaryMap = buildPropertyEventSummary(rows);
  const summary = summaryMap.get("prop-1");
  assert.ok(summary, "summary missing");
  if (!summary) return;

  assert.equal(summary.views, 2);
  assert.equal(summary.uniqueViews, 1);
  assert.equal(summary.saveToggles, 1);
  assert.equal(summary.netSaves, 1);
  assert.equal(summary.enquiries, 1);
  assert.equal(summary.viewingRequests, 1);
  assert.equal(summary.featuredImpressions, 1);
  assert.equal(summary.featuredClicks, 1);
  assert.equal(summary.featuredLeads, 1);
});

void test("estimateMissedDemand handles not enough data and weighted estimate", () => {
  const baseListing = {
    status: "paused_owner",
    paused_at: "2026-02-02T12:00:00Z",
  };

  const sparseEvents: PropertyEventRow[] = [
    {
      property_id: "prop-1",
      event_type: "property_view",
      session_key: "sess-a",
      occurred_at: "2026-02-01T10:00:00Z",
    },
    {
      property_id: "prop-1",
      event_type: "save_toggle",
      session_key: "sess-a",
      occurred_at: "2026-02-01T11:00:00Z",
      meta: { action: "save" },
    },
  ];

  const notEnough = estimateMissedDemand({
    listing: baseListing,
    events: sparseEvents,
    now: new Date("2026-02-03T12:00:00Z"),
  });

  assert.equal(notEnough.state, "not_enough_data");

  const richEvents: PropertyEventRow[] = [
    {
      property_id: "prop-1",
      event_type: "property_view",
      session_key: "sess-a",
      occurred_at: "2026-01-31T10:00:00Z",
    },
    {
      property_id: "prop-1",
      event_type: "property_view",
      session_key: "sess-b",
      occurred_at: "2026-01-31T10:05:00Z",
    },
    {
      property_id: "prop-1",
      event_type: "save_toggle",
      session_key: "sess-a",
      occurred_at: "2026-01-31T12:00:00Z",
      meta: { action: "save" },
    },
    {
      property_id: "prop-1",
      event_type: "lead_created",
      session_key: "sess-a",
      occurred_at: "2026-01-31T13:00:00Z",
    },
    {
      property_id: "prop-1",
      event_type: "property_view",
      session_key: "sess-c",
      occurred_at: "2026-02-01T09:00:00Z",
    },
    {
      property_id: "prop-1",
      event_type: "property_view",
      session_key: "sess-d",
      occurred_at: "2026-02-02T09:00:00Z",
    },
    {
      property_id: "prop-1",
      event_type: "save_toggle",
      session_key: "sess-d",
      occurred_at: "2026-02-02T09:30:00Z",
      meta: { action: "save" },
    },
  ];

  const estimate = estimateMissedDemand({
    listing: baseListing,
    events: richEvents,
    now: new Date("2026-02-03T12:00:00Z"),
  });

  assert.equal(estimate.state, "ok");
  if (estimate.state !== "ok") return;
  assert.equal(estimate.liveDays, 3);
  assert.equal(estimate.missed, 6);
});
