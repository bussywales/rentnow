import test from "node:test";
import assert from "node:assert/strict";

import { validateQuietHoursForSave } from "../../components/tenant/NotificationSettingsCard";

void test("quiet-hours save validation accepts overnight ranges", () => {
  const error = validateQuietHoursForSave({
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
  });

  assert.equal(error, null);
});

void test("quiet-hours save validation rejects equal start/end", () => {
  const error = validateQuietHoursForSave({
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "22:00",
  });

  assert.equal(error, "Start and end times must be different.");
});

void test("quiet-hours save validation requires both values when enabled", () => {
  const error = validateQuietHoursForSave({
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: null,
  });

  assert.equal(
    error,
    "Choose a start and end time. Overnight ranges (e.g., 22:00–07:00) are supported."
  );
});
