import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeMessageContent } from "../../lib/messaging/contact-exchange";

test("redacts emails in redact mode", () => {
  const input = "Email me at john@example.com for details.";
  const result = sanitizeMessageContent(input, "redact");
  assert.equal(result.action, "redact");
  assert.ok(result.text.includes("[email removed]"));
  assert.ok(result.meta?.types.includes("email"));
});

test("redacts phones in redact mode", () => {
  const input = "Call me on +234 803 123 4567.";
  const result = sanitizeMessageContent(input, "redact");
  assert.equal(result.action, "redact");
  assert.ok(result.text.includes("[phone removed]"));
  assert.ok(result.meta?.types.includes("phone"));
});

test("redacts mixed content", () => {
  const input = "Email john@example.com or call +1 (415) 555-0123.";
  const result = sanitizeMessageContent(input, "redact");
  assert.equal(result.action, "redact");
  assert.ok(result.text.includes("[email removed]"));
  assert.ok(result.text.includes("[phone removed]"));
});

test("redacts obfuscated emails", () => {
  const input = "Reach me at john (at) gmail (dot) com.";
  const result = sanitizeMessageContent(input, "redact");
  assert.equal(result.action, "redact");
  assert.ok(result.text.includes("[email removed]"));
});

test("does not redact prices or beds", () => {
  const input = "Rent is USD 1200000 or £2,400 for 4 bed.";
  const result = sanitizeMessageContent(input, "redact");
  assert.equal(result.action, "allow");
  assert.equal(result.text, input);
});

test("blocks when mode is block and contact details present", () => {
  const input = "Email me at jane@example.com.";
  const result = sanitizeMessageContent(input, "block");
  assert.equal(result.action, "block");
});

test("passes through when mode is off", () => {
  const input = "Email me at jane@example.com.";
  const result = sanitizeMessageContent(input, "off");
  assert.equal(result.action, "allow");
  assert.equal(result.text, input);
});
