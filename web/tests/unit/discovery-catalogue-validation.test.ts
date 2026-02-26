import test from "node:test";
import assert from "node:assert/strict";
import { DISCOVERY_CATALOGUE, validateDiscoveryCatalogue } from "@/lib/discovery";

void test("discovery catalogue validator rejects duplicates, bad tags, bad ranges, and sensitive copy", () => {
  const now = new Date("2026-02-25T00:00:00.000Z");
  const sample = DISCOVERY_CATALOGUE[0];
  const { items, warnings } = validateDiscoveryCatalogue({
    now,
    items: [
      sample,
      { ...sample },
      { ...sample, id: "bad-market", marketTags: ["ZZ" as never] },
      { ...sample, id: "bad-range", validFrom: "2026-03-01", validTo: "2026-02-01" },
      { ...sample, id: "bad-sensitive", title: "Homes for one ethnicity only" },
      { ...sample, id: "bad-badge", badges: ["TRENDING" as never] },
      { ...sample, id: "bad-verified", badges: ["VERIFIED"] },
    ],
  });

  assert.equal(items.length, 1);
  assert.ok(warnings.some((warning) => warning.includes("duplicate id")));
  assert.ok(warnings.some((warning) => warning.includes("unknown market tags")));
  assert.ok(warnings.some((warning) => warning.includes("validFrom is later than validTo")));
  assert.ok(warnings.some((warning) => warning.includes("restricted token")));
  assert.ok(warnings.some((warning) => warning.includes("unknown badges")));
  assert.ok(warnings.some((warning) => warning.includes("requires verificationBasis")));
});

void test("discovery catalogue validator filters disabled and out-of-window entries", () => {
  const now = new Date("2026-02-25T00:00:00.000Z");
  const sample = DISCOVERY_CATALOGUE[0];
  const { items } = validateDiscoveryCatalogue({
    now,
    items: [
      sample,
      { ...sample, id: "disabled", disabled: true },
      { ...sample, id: "future", validFrom: "2026-03-01" },
      { ...sample, id: "expired", validTo: "2026-02-24" },
    ],
  });

  assert.deepEqual(items.map((item) => item.id), [sample.id]);
});

void test("discovery catalogue validator suppresses console warnings in production", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (message?: unknown) => {
    warnings.push(String(message ?? ""));
  };

  try {
    validateDiscoveryCatalogue({
      now: new Date("2026-02-25T00:00:00.000Z"),
      items: [
        {
          ...DISCOVERY_CATALOGUE[0],
          id: "",
        },
      ],
    });
    assert.equal(warnings.length, 0);
  } finally {
    console.warn = originalWarn;
    process.env.NODE_ENV = originalNodeEnv;
  }
});
