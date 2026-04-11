import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

void test("subscription pricing audit page exposes bounded history, filters, pagination, and row history links", () => {
  const page = read("app/admin/settings/billing/prices/history/page.tsx");

  assert.match(page, /Subscription pricing audit log/);
  assert.match(page, /Subscription pricing row history/);
  assert.match(page, /Full bounded audit log/);
  assert.match(page, /Page \{audit\.page\} of \{audit\.totalPages\}/);
  assert.match(page, /name="market"/);
  assert.match(page, /name="role"/);
  assert.match(page, /name="cadence"/);
  assert.match(page, /name="eventType"/);
  assert.match(page, /name="actorId"/);
  assert.match(page, /name="dateFrom"/);
  assert.match(page, /name="dateTo"/);
  assert.match(page, /Previous/);
  assert.match(page, /Next/);
  assert.match(page, /View row history/);
  assert.match(page, /Back to control plane/);
});
