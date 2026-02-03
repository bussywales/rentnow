import test from "node:test";
import assert from "node:assert/strict";
import { SUPPORT_FAQ_ITEMS } from "../../lib/support/support-content";

void test("support FAQ includes required questions", () => {
  const questions = SUPPORT_FAQ_ITEMS.map((item) => item.question);

  assert.ok(
    questions.includes("How do I request a viewing?"),
    "expected FAQ to cover viewing requests"
  );
  assert.ok(
    questions.includes("Can I reschedule or cancel a viewing?"),
    "expected FAQ to cover viewing changes"
  );
  assert.ok(
    questions.includes("How do I report a listing?"),
    "expected FAQ to cover reporting listings"
  );
  assert.ok(
    questions.includes("Why did a listing disappear?"),
    "expected FAQ to cover listing disappearance"
  );
  assert.ok(
    questions.includes("How do payments work?"),
    "expected FAQ to cover payments"
  );
  assert.ok(
    questions.includes("What are key safety tips?"),
    "expected FAQ to cover safety guidance"
  );
});
