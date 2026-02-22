import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const settingsFormPath = path.join(
  process.cwd(),
  "components",
  "host",
  "HostShortletSettingsForm.tsx"
);

void test("host shortlet settings renders check-in and house-rules section with guest preview", () => {
  const source = fs.readFileSync(settingsFormPath, "utf8");
  assert.match(source, /Guest arrival &amp; house rules/);
  assert.ok(source.includes('data-testid="shortlet-checkin-rules-section"'));
  assert.ok(source.includes('data-testid="shortlet-checkin-rules-preview"'));
  assert.match(source, /Preview as guest/);
});

void test("host shortlet settings submits check-in and house-rules fields in payload", () => {
  const source = fs.readFileSync(settingsFormPath, "utf8");
  assert.match(source, /checkin_instructions/);
  assert.match(source, /checkin_window_start/);
  assert.match(source, /checkin_window_end/);
  assert.match(source, /access_method/);
  assert.match(source, /access_code_hint/);
  assert.match(source, /house_rules/);
  assert.match(source, /pets_allowed/);
  assert.match(source, /smoking_allowed/);
  assert.match(source, /parties_allowed/);
  assert.match(source, /max_guests_override/);
  assert.match(source, /emergency_notes/);
});
