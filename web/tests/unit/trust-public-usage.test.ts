import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("properties pages avoid direct trust field queries", () => {
  const pages = [
    path.join(process.cwd(), "app", "properties", "page.tsx"),
    path.join(process.cwd(), "app", "properties", "[id]", "page.tsx"),
  ];
  const disallowedTokens = [
    "email_verified",
    "phone_verified",
    "bank_verified",
    "reliability_power",
    "reliability_water",
    "reliability_internet",
  ];

  pages.forEach((pagePath) => {
    const contents = fs.readFileSync(pagePath, "utf8");
    disallowedTokens.forEach((token) => {
      assert.ok(
        !contents.includes(token),
        `unexpected trust field reference in ${pagePath}: ${token}`
      );
    });
  });
});
