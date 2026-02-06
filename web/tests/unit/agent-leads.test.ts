import test from "node:test";
import assert from "node:assert/strict";
import {
  agentLeadPayloadSchema,
  getRateLimitWindowStart,
  isHoneypotTriggered,
} from "@/lib/agents/agent-leads";

void test("agentLeadPayloadSchema validates basic fields", () => {
  const parsed = agentLeadPayloadSchema.safeParse({
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+2348012345678",
    message: "Interested in a 2 bedroom apartment in Lekki.",
  });
  assert.equal(parsed.success, true);

  const invalid = agentLeadPayloadSchema.safeParse({
    name: "J",
    email: "nope",
    message: "short",
  });
  assert.equal(invalid.success, false);
});

void test("isHoneypotTriggered detects hidden field", () => {
  const payload = {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: null,
    message: "Hello there, I need help.",
    company: "botnet",
  };
  assert.equal(isHoneypotTriggered(payload), true);
  assert.equal(isHoneypotTriggered({ ...payload, company: "" }), false);
});

void test("getRateLimitWindowStart returns ISO timestamp", () => {
  const now = new Date("2026-02-06T12:00:00.000Z");
  const window = getRateLimitWindowStart(now, 15);
  assert.equal(window, "2026-02-06T11:45:00.000Z");
});
