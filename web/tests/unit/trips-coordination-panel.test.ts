import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("trip coordination panel renders guest note form and support actions", () => {
  const filePath = path.join(
    process.cwd(),
    "components",
    "trips",
    "TripCoordinationPanel.tsx"
  );
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes('data-testid="trip-coordination-panel"'));
  assert.ok(contents.includes("Send host a note"));
  assert.ok(contents.includes("/api/shortlet/bookings/${props.bookingId}/note"));
  assert.ok(contents.includes("Report an issue"));
  assert.ok(contents.includes("Find another stay"));
});
