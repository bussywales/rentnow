import test from "node:test";
import assert from "node:assert/strict";
import { leadCreateSchema, leadStatusUpdateSchema, buildLeadSystemMessage } from "../../lib/leads/lead-schema";

const propertyId = "11111111-1111-4111-8111-111111111111";

test("lead schema parses numeric inputs", () => {
  const payload = leadCreateSchema.parse({
    property_id: propertyId,
    message: "Looking to buy within 3 months.",
    budget_min: "50000",
    budget_max: "",
    financing_status: "CASH",
    timeline: "ASAP",
  });
  assert.equal(payload.budget_min, 50000);
  assert.equal(payload.budget_max, null);
});

test("lead status update accepts valid status", () => {
  const payload = leadStatusUpdateSchema.parse({ status: "CONTACTED" });
  assert.equal(payload.status, "CONTACTED");
});

test("system message includes lead text", () => {
  const message = buildLeadSystemMessage("Hello host");
  assert.ok(message.includes("New buy enquiry submitted"));
  assert.ok(message.includes("Hello host"));
});
