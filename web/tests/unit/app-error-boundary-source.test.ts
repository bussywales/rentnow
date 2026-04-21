import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("global app error boundary reports runtime errors to the client error endpoint", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "error.tsx"), "utf8");

  assert.match(source, /captureClientBoundaryException\(error, \{/);
  assert.match(source, /navigator\.sendBeacon/);
  assert.match(source, /fetch\(url, \{/);
  assert.match(source, /const url = "\/api\/client-errors"/);
  assert.match(source, /requestId=\{error\.digest\}/);
});
