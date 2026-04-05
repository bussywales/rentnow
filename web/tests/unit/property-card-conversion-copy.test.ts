import path from "node:path";
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

test("property card CTA keeps a clear follow-up hint", async () => {
  const source = await readFile(
    path.join(process.cwd(), "components", "properties", "PropertyCard.tsx"),
    "utf8"
  );

  assert.match(source, /const ctaSupportText =/);
  assert.match(source, /Save it for later or open the listing to request a viewing\./);
  assert.match(source, /Save it to your shortlist or open the listing to send a verified enquiry\./);
  assert.match(source, /Save it now or open the listing to confirm dates and booking details\./);
});
