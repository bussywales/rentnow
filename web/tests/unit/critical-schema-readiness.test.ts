import test from "node:test";
import assert from "node:assert/strict";

import {
  getCriticalSchemaReadiness,
  type CriticalSchemaRequirement,
} from "@/lib/ops/critical-schema-readiness";

void test("critical schema readiness succeeds when all required columns exist", async () => {
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
    rpc: async () => ({
      data: [
        { table_name: "properties", column_name: "commercial_layout_type" },
        { table_name: "properties", column_name: "enclosed_rooms" },
      ],
      error: null,
    }),
  };

  const result = await getCriticalSchemaReadiness(client, requirements);
  assert.equal(result.ready, true);
  assert.deepEqual(result.missing, []);
  assert.equal(result.queryError, null);
});

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
    rpc: async () => ({
      data: [{ table_name: "properties", column_name: "commercial_layout_type" }],
      error: null,
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
    rpc: async () => ({
      data: null,
      error: { message: "rpc get_public_table_columns failed" },
    }),
  };

  const result = await getCriticalSchemaReadiness(client, requirements);
  assert.equal(result.ready, false);
  assert.equal(result.queryError, "rpc get_public_table_columns failed");
});
