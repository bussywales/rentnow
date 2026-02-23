import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("workspace home wires featured rail component with the visual landing section", () => {
  const pagePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.match(
    contents,
    /<HomeListingRail[\s\S]*title=\"Featured listings\"[\s\S]*sectionTestId=\"home-featured-strip\"/,
    "expected featured home rail component wiring"
  );
  assert.match(
    contents,
    /sectionTestId=\"home-featured-strip\"/,
    "expected featured strip section marker"
  );
  assert.match(
    contents,
    /sectionTestId=\"home-rail-new-this-week\"/,
    "expected new-this-week rail section marker"
  );
  assert.match(
    contents,
    /sectionTestId=\"home-rail-most-saved\"/,
    "expected most-saved rail section marker"
  );
  assert.match(
    contents,
    /sectionTestId=\"home-rail-most-viewed\"/,
    "expected most-viewed rail section marker"
  );
});
