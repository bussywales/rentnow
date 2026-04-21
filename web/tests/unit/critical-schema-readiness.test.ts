import test from "node:test";
import assert from "node:assert/strict";

import {
  getCriticalSchemaReadiness,
  type CriticalSchemaRequirement,
} from "@/lib/ops/critical-schema-readiness";

void test("critical schema readiness reports missing columns", async () => {
  const requirements: CriticalSchemaRequirement[] = [
    {
      table: "properties",
      column: "commercial_layout_type",
      feature: "commercial listing authoring",
    },
    {
      table: "properties",
      column: "enclosed_rooms",
      feature: "commercial listing authoring",
    },
  ];

  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({
            data: [{ column_name: "commercial_layout_type" }],
            error: null,
          }),
        }),
      }),
    }),
  };

  const result = await getCriticalSchemaReadiness(client, requirements);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, [requirements[1]]);
});

void test("critical schema readiness surfaces query errors", async () => {
  const requirements: CriticalSchemaRequirement[] = [
    {
      table: "properties",
      column: "commercial_layout_type",
      feature: "commercial listing authoring",
    },
  ];

  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({
            data: null,
            error: { message: "permission denied for table information_schema.columns" },
          }),
        }),
      }),
    }),
  };

  const result = await getCriticalSchemaReadiness(client, requirements);
  assert.equal(result.ready, false);
  assert.equal(result.queryError, "permission denied for table information_schema.columns");
});
