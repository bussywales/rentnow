import path from "node:path";
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

test("properties browse page exposes a sharper conversion strip", async () => {
  const source = await readFile(
    path.join(process.cwd(), "app", "properties", "page.tsx"),
    "utf8"
  );

  assert.match(source, /Turn browsing into a plan/);
  assert.match(source, /Follow this search for alerts, save homes to a shortlist, or post a request if none of these fit\./);
  assert.match(source, /getPropertyRequestQuickStartEntry/);
});

test("property detail page keeps request fallback and save guidance visible", async () => {
  const source = await readFile(
    path.join(process.cwd(), "app", "properties", "[id]", "page.tsx"),
    "utf8"
  );

  assert.match(source, /Save this home to revisit later or organise it into a shortlist from your collections\./);
  assert.match(source, /Not the right fit\?/);
  assert.match(source, /Post what you need and let matching hosts respond with suitable homes\./);
  assert.match(source, /Send your questions here and keep replies in one thread so you can compare homes without losing context\./);
});
