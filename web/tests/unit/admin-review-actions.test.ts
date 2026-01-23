import test from "node:test";
import assert from "node:assert/strict";
import { validateRequestNote } from "@/lib/admin/admin-review-actions";

void test("validateRequestNote requires non-empty note", () => {
  const empty = validateRequestNote("");
  assert.equal(empty.ok, false);
});

void test("validateRequestNote enforces minimum length", () => {
  const short = validateRequestNote("hi");
  assert.equal(short.ok, false);
});

void test("validateRequestNote accepts valid note", () => {
  const ok = validateRequestNote("Please add more photos.");
  assert.equal(ok.ok, true);
});
