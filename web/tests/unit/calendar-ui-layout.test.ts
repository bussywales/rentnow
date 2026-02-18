import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("calendar month header keeps title centered with nav in header area", () => {
  const filePath = path.join(process.cwd(), "components", "ui", "calendar.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes('month_caption: "relative flex items-center justify-center pt-1"'));
  assert.ok(contents.includes('nav: "absolute right-1 top-1 flex items-center gap-1"'));
});

void test("calendar disabled days use obvious inactive styling", () => {
  const filePath = path.join(process.cwd(), "components", "ui", "calendar.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes("disabled:cursor-not-allowed"));
  assert.ok(contents.includes("disabled:bg-slate-50"));
  assert.ok(contents.includes('disabled: "bg-slate-50 text-slate-300 opacity-100 cursor-not-allowed"'));
});
