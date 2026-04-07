import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("reporting handoff doc defines stakeholder and operator dashboard build sources", () => {
  const handoffPath = path.join(process.cwd(), "docs", "runbooks", "looker-studio-handoff.md");
  const contents = fs.readFileSync(handoffPath, "utf8");

  assert.ok(contents.includes("PH - GA4 - Production"));
  assert.ok(contents.includes("PH - Product Events - Production"));
  assert.ok(contents.includes("PH - Reporting Checkout Funnel - Production"));
  assert.ok(contents.includes("PH - Reporting Paid Host Activation - Production"));
  assert.ok(contents.includes("PH - Reporting Campaign Conversion - Production"));
  assert.ok(contents.includes("PH Stakeholder Traction Dashboard"));
  assert.ok(contents.includes("PH Operator Funnel and QA Dashboard"));
  assert.ok(contents.includes("Executive summary"));
  assert.ok(contents.includes("Billing funnel diagnostics"));
  assert.ok(contents.includes("must not be blended casually"));
});

void test("reporting metric dictionary keeps core reporting terms aligned with first-party schema and GA4 split", () => {
  const dictionaryPath = path.join(process.cwd(), "docs", "runbooks", "reporting-metric-dictionary.md");
  const contents = fs.readFileSync(dictionaryPath, "utf8");

  assert.ok(contents.includes("Session"));
  assert.ok(contents.includes("Attributed session"));
  assert.ok(contents.includes("Checkout started"));
  assert.ok(contents.includes("Checkout succeeded"));
  assert.ok(contents.includes("Paid host"));
  assert.ok(contents.includes("GA4 sessions and first-party event rows are not interchangeable denominators"));
  assert.ok(contents.includes("`reporting.checkout_funnel_daily`"));
  assert.ok(contents.includes("`reporting.paid_host_activation_daily`"));
  assert.ok(contents.includes("`reporting.campaign_conversion_daily`"));
});
