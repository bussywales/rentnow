import test from "node:test";
import assert from "node:assert/strict";

import {
  formatCooldownMessage,
  getCooldownRemaining,
  resolveCooldownUntil,
} from "../../lib/messaging/cooldown";

void test("cooldown activates with retry metadata", () => {
  const now = 1_000;
  const until = resolveCooldownUntil(5, now);
  assert.equal(until, 6_000);
  assert.equal(getCooldownRemaining(until, now), 5);
});

void test("cooldown countdown decreases over time", () => {
  const now = 1_000;
  const until = resolveCooldownUntil(5, now);
  assert.equal(getCooldownRemaining(until, 3_000), 3);
});

void test("cooldown expires and send can resume", () => {
  const now = 1_000;
  const until = resolveCooldownUntil(2, now);
  assert.equal(getCooldownRemaining(until, 4_000), 0);
});

void test("cooldown message includes remaining seconds", () => {
  const message = formatCooldownMessage(4);
  assert.equal(
    message,
    "You're sending messages too quickly. Try again in 4s."
  );
});
