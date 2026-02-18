import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("calendar month header keeps title centered with nav in header area", () => {
  const filePath = path.join(process.cwd(), "components", "ui", "calendar.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes('navLayout={navLayout ?? "after"}'));
  assert.ok(contents.includes('month: "relative space-y-4"'));
  assert.ok(contents.includes('month_caption: "relative flex items-center justify-center pt-1 pr-16"'));
  assert.ok(contents.includes('nav: "absolute right-1 top-0.5 flex items-center gap-1"'));
});

void test("calendar disabled days use obvious inactive styling", () => {
  const filePath = path.join(process.cwd(), "components", "ui", "calendar.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes("disabled:pointer-events-none"));
  assert.ok(contents.includes("disabled:bg-slate-100"));
  assert.ok(contents.includes('disabled: "bg-slate-100 text-slate-400 opacity-100 cursor-not-allowed"'));
});
