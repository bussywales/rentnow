import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host listings manager surfaces explicit approval workflow states and next-step guidance", () => {
  const filePath = path.join(process.cwd(), "components", "host", "HostListingsManager.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /Changes requested/);
  assert.match(source, /Rejected/);
  assert.match(source, /buildListingApprovalGuidance/);
  assert.match(source, /guidance\.summary/);
  assert.match(source, /guidance\.reasonSummary/);
  assert.match(source, /guidance\.nextActionLabel/);
});
