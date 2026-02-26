import test from "node:test";
import assert from "node:assert/strict";
import {
  createApplyAndCloseAction,
  createClearApplyAndCloseAction,
  createResetDraftAction,
} from "@/components/filters/filter-actions";

void test("createResetDraftAction restores draft from applied snapshot", () => {
  let draft = { value: 0 };
  const action = createResetDraftAction(
    () => ({ value: 2 }),
    (next) => {
      draft = next;
    }
  );

  action();
  assert.deepEqual(draft, { value: 2 });
});

void test("createApplyAndCloseAction runs apply then close", () => {
  const calls: string[] = [];
  const action = createApplyAndCloseAction(
    () => calls.push("apply"),
    () => calls.push("close")
  );

  action();
  assert.deepEqual(calls, ["apply", "close"]);
});

void test("createClearApplyAndCloseAction creates default, applies, and closes", () => {
  let draft = { value: 5 };
  let applied = { value: 5 };
  const calls: string[] = [];
  const action = createClearApplyAndCloseAction(
    () => ({ value: 0 }),
    (next) => {
      draft = next;
      calls.push("draft");
    },
    (next) => {
      applied = next;
      calls.push("apply");
    },
    () => calls.push("close")
  );

  action();
  assert.deepEqual(draft, { value: 0 });
  assert.deepEqual(applied, { value: 0 });
  assert.deepEqual(calls, ["draft", "apply", "close"]);
});
