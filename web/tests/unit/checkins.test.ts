import { describe, it } from "node:test";
import assert from "node:assert";
import {
  bucketDistance,
  deriveCheckinSignal,
  haversineDistanceMeters,
  sanitizeAccuracyM,
} from "@/lib/properties/checkins";

describe("check-ins", () => {
  it("buckets distance", () => {
    assert.strictEqual(bucketDistance(10), "onsite");
    assert.strictEqual(bucketDistance(150), "onsite");
    assert.strictEqual(bucketDistance(900), "near");
    assert.strictEqual(bucketDistance(1000), "near");
    assert.strictEqual(bucketDistance(1500), "far");
  });

  it("computes haversine distance roughly", () => {
    const d = haversineDistanceMeters({
      lat1: 0,
      lng1: 0,
      lat2: 0,
      lng2: 0.001,
    });
    assert.ok(d > 90);
    assert.ok(d < 120);
  });

  it("derives signal when flag off", () => {
    const signal = deriveCheckinSignal(
      {
        property_id: "x",
        created_at: new Date().toISOString(),
        distance_bucket: "onsite",
        method: "browser_geolocation",
      },
      { flagEnabled: false }
    );
    assert.strictEqual(signal.status, "hidden");
  });

  it("derives recent vs stale", () => {
    const recent = deriveCheckinSignal(
      {
        property_id: "x",
        created_at: new Date().toISOString(),
        distance_bucket: "near",
        method: "browser_geolocation",
      },
      { flagEnabled: true }
    );
    assert.strictEqual(recent.status, "recent_checkin");

    const stale = deriveCheckinSignal(
      {
        property_id: "x",
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        distance_bucket: "near",
        method: "browser_geolocation",
      },
      { flagEnabled: true }
    );
    assert.strictEqual(stale.status, "stale_checkin");
  });

  it("sanitizes accuracy", () => {
    assert.strictEqual(sanitizeAccuracyM(25.2), 25);
    assert.strictEqual(sanitizeAccuracyM(-5), 0);
    assert.strictEqual(sanitizeAccuracyM(200000), 100000);
    assert.strictEqual(sanitizeAccuracyM("bad"), null);
  });
});
