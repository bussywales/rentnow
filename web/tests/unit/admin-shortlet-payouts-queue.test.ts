import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const adminPagePath = path.join(process.cwd(), "app", "admin", "shortlets", "payouts", "page.tsx");
const tablePath = path.join(process.cwd(), "components", "admin", "AdminShortletPayoutsTable.tsx");
const serverPath = path.join(process.cwd(), "lib", "shortlet", "shortlet.server.ts");
const exportPath = path.join(
  process.cwd(),
  "app",
  "api",
  "admin",
  "shortlets",
  "payouts",
  "export.csv",
  "route.ts"
);

void test("admin payouts page defaults to requested queue and passes queue filter", () => {
  const pageContents = fs.readFileSync(adminPagePath, "utf8");

  assert.match(pageContents, /const queue = .*\? "all" : "requested"/);
  assert.match(pageContents, /queue,/);
  assert.match(pageContents, /<option value="requested">Requested<\/option>/);
});

void test("admin payouts table surfaces request queue metadata", () => {
  const tableContents = fs.readFileSync(tablePath, "utf8");

  assert.match(tableContents, /Requested payouts:/);
  assert.match(tableContents, /<th className="px-4 py-3">Request<\/th>/);
  assert.match(tableContents, /Requested/);
  assert.match(tableContents, /Not requested/);
  assert.match(tableContents, /Method: \{row\.requested_method\}/);
});

void test("shortlet payout server and export include request status fields", () => {
  const serverContents = fs.readFileSync(serverPath, "utf8");
  const exportContents = fs.readFileSync(exportPath, "utf8");

  assert.match(serverContents, /request_status: request \? "requested" : "not_requested"/);
  assert.match(serverContents, /requested_method/);
  assert.match(serverContents, /if \(input\.queue === "requested"\)/);

  assert.match(exportContents, /const queue = queueParam === "all" \? "all" : "requested"/);
  assert.match(exportContents, /"request_status"/);
  assert.match(exportContents, /"requested_method"/);
});
