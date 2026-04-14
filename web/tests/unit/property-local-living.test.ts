import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLocalLivingFacts,
  countLocalLivingDetails,
  hasBoreholeWater,
  hasBroadbandOrFibre,
  hasSecurityFeature,
  hasStructuredPowerBackup,
} from "@/lib/properties/local-living";

test("buildLocalLivingFacts returns concise listing-local facts", () => {
  const facts = buildLocalLivingFacts({
    backup_power_type: "inverter",
    water_supply_type: "borehole",
    internet_availability: "fibre",
    security_type: "gated_estate",
    road_access_quality: "paved_easy",
    flood_risk_disclosure: "seasonal",
  });

  assert.deepEqual(
    facts.map((fact) => fact.label),
    ["Backup power", "Water source", "Internet", "Security", "Road access", "Flood disclosure"]
  );
  assert.equal(facts.at(-1)?.tone, "warning");
});

test("local living helper predicates stay practical and narrow", () => {
  assert.equal(hasStructuredPowerBackup({ backup_power_type: "generator" }), true);
  assert.equal(hasStructuredPowerBackup({ backup_power_type: "none" }), false);
  assert.equal(hasBoreholeWater({ water_supply_type: "mixed" }), true);
  assert.equal(hasBroadbandOrFibre({ internet_availability: "mobile_only" }), false);
  assert.equal(hasSecurityFeature({ security_type: "gated_estate" }), true);
  assert.equal(
    countLocalLivingDetails({
      backup_power_type: "generator",
      water_supply_type: "mains",
      internet_availability: null,
      security_type: "cctv",
      road_access_quality: null,
      flood_risk_disclosure: null,
    }),
    3
  );
});
