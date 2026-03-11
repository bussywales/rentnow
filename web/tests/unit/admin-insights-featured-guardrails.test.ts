import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("insights featured controls carry demo guardrails", () => {
  const root = process.cwd();

  const drilldownsPath = path.join(root, "lib", "admin", "insights-drilldowns.ts");
  const drilldownsContents = fs.readFileSync(drilldownsPath, "utf8");
  assert.ok(
    drilldownsContents.includes("is_featured,featured_until,is_demo"),
    "expected insights listing-health query to include is_demo"
  );

  const supplyHealthPath = path.join(root, "lib", "admin", "supply-health.server.ts");
  const supplyHealthContents = fs.readFileSync(supplyHealthPath, "utf8");
  assert.ok(
    supplyHealthContents.includes("is_featured,is_demo,listing_intent"),
    "expected supply-health query to include is_demo"
  );

  const listingClientPath = path.join(root, "components", "admin", "InsightsListingHealthClient.tsx");
  const listingClientContents = fs.readFileSync(listingClientPath, "utf8");
  assert.ok(
    listingClientContents.includes("if (nextFeatured && row.is_demo)"),
    "expected listing health table to block demo feature attempts"
  );
  assert.ok(
    listingClientContents.includes("disabled={busyId === row.id || !!row.is_demo}"),
    "expected listing health feature action to be disabled for demo rows"
  );

  const supplyClientPath = path.join(root, "components", "admin", "InsightsSupplyHealthClient.tsx");
  const supplyClientContents = fs.readFileSync(supplyClientPath, "utf8");
  assert.ok(
    supplyClientContents.includes("if (nextFeatured && row.is_demo)"),
    "expected supply health table to block demo feature attempts"
  );
  assert.ok(
    supplyClientContents.includes("disabled={busyId === row.id || !!row.is_demo}"),
    "expected supply health feature action to be disabled for demo rows"
  );
});
