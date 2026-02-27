import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveNotificationSettingsUiState,
  normalizeQuietTimeForSave,
  validateQuietHoursForSave,
} from "../../components/tenant/NotificationSettingsCard";

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

void test("quiet-hours save validation accepts values with spaces around colon", () => {
  const error = validateQuietHoursForSave({
    quietHoursEnabled: true,
    quietHoursStart: "22 : 00",
    quietHoursEnd: "07 : 00",
  });

  assert.equal(error, null);
});

void test("normalizeQuietTimeForSave pads one-digit hour", () => {
  assert.equal(normalizeQuietTimeForSave("7:05"), "07:05");
  assert.equal(normalizeQuietTimeForSave("22 : 30"), "22:30");
  assert.equal(normalizeQuietTimeForSave("24:00"), null);
});

void test("ui state: initial quiet-hours off keeps save enabled and hides error", () => {
  const state = deriveNotificationSettingsUiState({
    loading: false,
    saving: false,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    quietHoursInteracted: false,
    attemptedSave: false,
  });

  assert.equal(state.disableSave, false);
  assert.equal(state.showQuietHoursError, false);
  assert.equal(state.quietHoursError, null);
});

void test("ui state: missing quiet-hours end disables save and defers error until interaction", () => {
  const calmState = deriveNotificationSettingsUiState({
    loading: false,
    saving: false,
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: null,
    quietHoursInteracted: false,
    attemptedSave: false,
  });

  assert.equal(calmState.disableSave, true);
  assert.equal(calmState.showQuietHoursError, false);

  const interactedState = deriveNotificationSettingsUiState({
    loading: false,
    saving: false,
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: null,
    quietHoursInteracted: true,
    attemptedSave: false,
  });

  assert.equal(interactedState.disableSave, true);
  assert.equal(interactedState.showQuietHoursError, true);
});

void test("ui state: overnight quiet-hours remain valid", () => {
  const state = deriveNotificationSettingsUiState({
    loading: false,
    saving: false,
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    quietHoursInteracted: true,
    attemptedSave: true,
  });

  assert.equal(state.disableSave, false);
  assert.equal(state.showQuietHoursError, false);
  assert.equal(state.quietHoursError, null);
});

void test("ui state: equal quiet-hours disable save and show error after interaction", () => {
  const state = deriveNotificationSettingsUiState({
    loading: false,
    saving: false,
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "22:00",
    quietHoursInteracted: true,
    attemptedSave: false,
  });

  assert.equal(state.disableSave, true);
  assert.equal(state.showQuietHoursError, true);
  assert.equal(state.quietHoursError, "Start and end times must be different.");
});
