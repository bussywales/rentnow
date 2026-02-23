import test from "node:test";
import assert from "node:assert/strict";
import { buildEditorUrl } from "@/lib/properties/host-dashboard";

void test("buildEditorUrl includes step query", () => {
  const url = buildEditorUrl("abc", undefined, { step: "photos" });
  assert.equal(url, "/host/properties/abc/edit?step=photos");
});

void test("buildEditorUrl includes focus query", () => {
  const url = buildEditorUrl("abc", undefined, { focus: "location" });
  assert.equal(url, "/host/properties/abc/edit?focus=location");
});
