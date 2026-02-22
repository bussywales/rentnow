import test from "node:test";
import assert from "node:assert/strict";
import {
  redactCheckinDetailsForGuest,
  type ShortletCheckinDetails,
} from "@/lib/shortlet/checkin-visibility";

const sourceDetails: ShortletCheckinDetails = {
  checkin_instructions: "Enter through the side gate and ring the bell.",
  checkin_window_start: "14:00:00",
  checkin_window_end: "19:00:00",
  checkout_time: "11:00:00",
  access_method: "Lockbox",
  access_code_hint: "Code shared after approval.",
  parking_info: "Visitor bay B12",
  wifi_info: "Router under TV stand",
  house_rules: "No smoking indoors. Keep noise low after 10pm.",
  quiet_hours_start: "22:00:00",
  quiet_hours_end: "06:00:00",
  pets_allowed: false,
  smoking_allowed: false,
  parties_allowed: false,
  max_guests_override: 4,
  emergency_notes: "Use building front desk for urgent help.",
};

void test("limited visibility strips access-sensitive fields", () => {
  const redacted = redactCheckinDetailsForGuest(sourceDetails, "limited");
  assert.ok(redacted);
  assert.equal(redacted.access_code_hint, null);
  assert.equal(redacted.access_method, null);
  assert.equal(redacted.wifi_info, null);
  assert.equal(redacted.parking_info, null);
  assert.equal(redacted.checkin_instructions, null);
  assert.equal(redacted.house_rules, sourceDetails.house_rules);
  assert.equal(redacted.checkin_window_start, sourceDetails.checkin_window_start);
});

void test("full visibility keeps all check-in fields", () => {
  const full = redactCheckinDetailsForGuest(sourceDetails, "full");
  assert.deepEqual(full, sourceDetails);
});

void test("none visibility returns null payload", () => {
  const hidden = redactCheckinDetailsForGuest(sourceDetails, "none");
  assert.equal(hidden, null);
});
