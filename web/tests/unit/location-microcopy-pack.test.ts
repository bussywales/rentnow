import test from "node:test";
import assert from "node:assert/strict";
import { LOCATION_MICROCOPY } from "@/lib/location-microcopy";

void test("location microcopy pack matches canonical strings", () => {
  assert.equal(LOCATION_MICROCOPY.search.label, "Search for an area");
  assert.equal(
    LOCATION_MICROCOPY.search.helper1,
    "Start here — choose the general area first. We’ll pin an approximate location and auto-fill the fields below."
  );
  assert.equal(
    LOCATION_MICROCOPY.search.helper2,
    "Tenants see an approximate area until you choose to share the exact location."
  );
  assert.equal(LOCATION_MICROCOPY.search.empty, "No matches. Try a nearby area or city.");
  assert.equal(
    LOCATION_MICROCOPY.search.notConfigured,
    "Location search isn’t configured yet. You can still enter the details below or add coordinates manually."
  );
  assert.equal(
    LOCATION_MICROCOPY.pinned.secondary,
    "Approximate area (from search)"
  );
  assert.equal(
    LOCATION_MICROCOPY.address.helper,
    "Optional. Not used for map search."
  );
});
