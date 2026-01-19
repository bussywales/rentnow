import test from "node:test";
import assert from "node:assert/strict";
import { parseAppSettingBool } from "@/lib/settings/app-settings";

void test("parseAppSettingBool respects booleans and enabled wrapper", () => {
  assert.equal(parseAppSettingBool(true, false), true);
  assert.equal(parseAppSettingBool({ enabled: true }, false), true);
  assert.equal(parseAppSettingBool({ enabled: false }, true), false);
});

void test("parseAppSettingBool falls back for malformed", () => {
  assert.equal(parseAppSettingBool("yes", true), true);
  assert.equal(parseAppSettingBool({ foo: "bar" }, false), false);
});

void test("parseAppSettingBool ignores unexpected shapes", () => {
  assert.equal(parseAppSettingBool({ enabled: "true" }, true), true);
  assert.equal(parseAppSettingBool({ enabled: null }, true), true);
});
